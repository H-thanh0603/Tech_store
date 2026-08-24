-- P1-01: staff account lifecycle, session revocation, and immutable audit identity.

alter table public.admin_users
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null;

alter table public.admin_audit_logs
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

create index if not exists admin_users_role_active_idx
  on public.admin_users (role, is_active);

create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_user_id, created_at desc);

create or replace function public.admin_manage_staff_account(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_display_name text,
  p_role text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor public.admin_users%rowtype;
  v_target public.admin_users%rowtype;
  v_name text := trim(coalesce(p_display_name, ''));
  v_action text;
begin
  if p_actor_user_id is null or p_target_user_id is null
     or char_length(v_name) not between 2 and 120
     or p_role not in ('admin', 'manager', 'staff')
     or p_is_active is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Serializes last-admin and self-management checks across concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended('admin_staff_account_lifecycle', 0));

  select * into v_actor
  from public.admin_users
  where user_id = p_actor_user_id and is_active and role = 'admin'
  for share;
  if not found then return jsonb_build_object('code', 'FORBIDDEN'); end if;

  select * into v_target
  from public.admin_users
  where user_id = p_target_user_id
  for update;

  if p_actor_user_id = p_target_user_id and found
     and (p_role <> v_target.role or p_is_active <> v_target.is_active) then
    return jsonb_build_object('code', 'SELF_MANAGEMENT_FORBIDDEN');
  end if;

  if found then
    if v_target.role = 'admin' and v_target.is_active
       and (p_role <> 'admin' or not p_is_active)
       and (select count(*) from public.admin_users where role = 'admin' and is_active) <= 1 then
      return jsonb_build_object('code', 'LAST_ADMIN');
    end if;

    update public.admin_users
    set display_name = v_name,
        role = p_role,
        is_active = p_is_active,
        disabled_at = case when p_is_active then null else coalesce(disabled_at, now()) end,
        disabled_by = case when p_is_active then null else p_actor_user_id end
    where user_id = p_target_user_id;
    v_action := case
      when v_target.is_active and not p_is_active then 'staff_disable'
      when not v_target.is_active and p_is_active then 'staff_enable'
      when v_target.role <> p_role then 'staff_role_change'
      else 'staff_profile_update'
    end;
  else
    insert into public.admin_users (user_id, display_name, role, is_active)
    values (p_target_user_id, v_name, p_role, p_is_active);
    v_action := 'staff_invite';
  end if;

  if not p_is_active then
    delete from auth.sessions where user_id = p_target_user_id;
  end if;

  insert into public.admin_audit_logs (
    action, entity_type, entity_id, payload, actor_label, actor_user_id
  ) values (
    v_action,
    'staff_account',
    p_target_user_id::text,
    jsonb_build_object(
      'displayName', v_name,
      'role', p_role,
      'isActive', p_is_active,
      'previousRole', v_target.role,
      'previousActive', v_target.is_active
    ),
    v_actor.display_name,
    p_actor_user_id
  );

  return jsonb_build_object('code', 'OK', 'action', v_action);
exception
  when foreign_key_violation then
    return jsonb_build_object('code', 'NOT_FOUND');
end;
$$;

create or replace function public.admin_revoke_staff_sessions(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor public.admin_users%rowtype;
  v_count integer;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if p_actor_user_id = p_target_user_id then
    return jsonb_build_object('code', 'SELF_MANAGEMENT_FORBIDDEN');
  end if;

  select * into v_actor
  from public.admin_users
  where user_id = p_actor_user_id and is_active and role = 'admin';
  if not found then return jsonb_build_object('code', 'FORBIDDEN'); end if;

  perform 1 from public.admin_users where user_id = p_target_user_id;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;

  delete from auth.sessions where user_id = p_target_user_id;
  get diagnostics v_count = row_count;

  insert into public.admin_audit_logs (
    action, entity_type, entity_id, payload, actor_label, actor_user_id
  ) values (
    'staff_sessions_revoke',
    'staff_account',
    p_target_user_id::text,
    jsonb_build_object('revokedSessions', v_count),
    v_actor.display_name,
    p_actor_user_id
  );

  return jsonb_build_object('code', 'OK', 'revokedSessions', v_count);
end;
$$;

create or replace function public.admin_list_audit_logs(
  p_entity_type text default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_rows jsonb;
begin
  select count(*) into v_total
  from admin_audit_logs
  where (p_entity_type is null or entity_type = p_entity_type)
    and (p_action is null or action = p_action)
    and (p_from is null or created_at >= p_from)
    and (p_to is null or created_at <= p_to);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'action', action,
    'entityType', entity_type,
    'entityId', entity_id,
    'payload', payload,
    'actorLabel', actor_label,
    'actorUserId', actor_user_id,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from admin_audit_logs
    where (p_entity_type is null or entity_type = p_entity_type)
      and (p_action is null or action = p_action)
      and (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    offset greatest(coalesce(p_offset, 0), 0)
  ) audit_rows;

  return jsonb_build_object('code', 'OK', 'total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.admin_manage_staff_account(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_revoke_staff_sessions(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_manage_staff_account(uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function public.admin_revoke_staff_sessions(uuid, uuid)
  to service_role;
