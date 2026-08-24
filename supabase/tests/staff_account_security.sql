begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_users' and column_name = 'disabled_at'
  ),
  'admin_users has disabled_at'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_audit_logs' and column_name = 'actor_user_id'
  ),
  'admin_audit_logs has actor_user_id'
);
select has_function(
  'public',
  'admin_manage_staff_account',
  array['uuid', 'uuid', 'text', 'text', 'boolean']
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_manage_staff_account(uuid, uuid, text, text, boolean)',
    'EXECUTE'
  ),
  'service role can manage staff accounts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_manage_staff_account(uuid, uuid, text, text, boolean)',
    'EXECUTE'
  ),
  'authenticated users cannot call staff management RPC'
);

insert into auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'security-admin@techstore.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'security-manager@techstore.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'security-staff@techstore.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into admin_users (user_id, display_name, role, is_active) values
  ('91000000-0000-4000-8000-000000000001', 'Security Admin', 'admin', true),
  ('91000000-0000-4000-8000-000000000002', 'Security Manager', 'manager', true);

select is(
  admin_manage_staff_account(
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003',
    'Escalated Staff', 'admin', true
  )->>'code',
  'FORBIDDEN',
  'manager cannot promote a user through the privileged RPC'
);

select is(
  admin_manage_staff_account(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'Security Admin', 'staff', true
  )->>'code',
  'SELF_MANAGEMENT_FORBIDDEN',
  'admin cannot demote itself'
);

select is(
  admin_manage_staff_account(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000003',
    'Security Staff', 'staff', true
  )->>'code',
  'OK',
  'admin can register a staff account'
);

insert into auth.sessions (id, user_id, created_at, updated_at, aal)
values (
  '91000000-0000-4000-8000-000000000010',
  '91000000-0000-4000-8000-000000000003',
  now(), now(), 'aal1'
);

select is(
  admin_manage_staff_account(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000003',
    'Security Staff', 'staff', false
  )->>'code',
  'OK',
  'admin can disable another staff account'
);

select ok(
  (select not is_active and disabled_at is not null
   from admin_users where user_id = '91000000-0000-4000-8000-000000000003'),
  'disabled account is locked immediately'
);

select is(
  (select count(*) from auth.sessions
   where user_id = '91000000-0000-4000-8000-000000000003'),
  0::bigint,
  'disabling an account revokes its database sessions'
);

select is(
  (select actor_user_id from admin_audit_logs
   where entity_type = 'staff_account'
     and entity_id = '91000000-0000-4000-8000-000000000003'
   order by created_at desc limit 1),
  '91000000-0000-4000-8000-000000000001'::uuid,
  'staff lifecycle audit stores immutable actor identity'
);

select ok(
  (select role = 'admin' and is_active
   from admin_users where user_id = '91000000-0000-4000-8000-000000000001'),
  'self-management guard preserves the active admin actor'
);

select * from finish();
rollback;
