-- Phase 5: order ops enhancements (events, notes, list RPC) + coupon admin helpers.
-- Does not change order_status enum values.

create table if not exists order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  event_type text not null default 'order_status'
    check (event_type in ('order_status', 'payment_status')),
  reason text,
  actor_label text not null default 'admin',
  created_at timestamptz not null default now()
);

create index order_status_events_order_id_idx on order_status_events (order_id, created_at desc);

create table if not exists order_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  actor_label text not null default 'admin',
  created_at timestamptz not null default now()
);

create index order_internal_notes_order_id_idx on order_internal_notes (order_id, created_at desc);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  actor_label text not null default 'admin',
  created_at timestamptz not null default now()
);

create index admin_audit_logs_entity_idx on admin_audit_logs (entity_type, entity_id, created_at desc);

alter table order_status_events enable row level security;
alter table order_internal_notes enable row level security;
alter table admin_audit_logs enable row level security;
-- service-role only (no anon policies)

-- Replace admin_update_order with reason/actor + event logging.
-- Cancel/expired require non-empty reason. Stock release remains idempotent via released_at is null.
create or replace function admin_update_order(
  p_order_code text,
  p_order_status text default null,
  p_payment_status text default null,
  p_reason text default null,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_from text;
  v_to text;
  v_res record;
  v_allowed boolean := false;
  v_actor text := coalesce(nullif(trim(p_actor_label), ''), 'admin');
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_pay_from text;
begin
  if p_order_code is null or trim(p_order_code) = '' then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;

  if p_order_status is null and p_payment_status is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
  for update;

  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;

  v_from := v_order.order_status;

  if p_payment_status is not null then
    if p_payment_status <> 'paid' then
      return jsonb_build_object('code', 'INVALID_PAYMENT');
    end if;
    if v_order.payment_status <> 'pending' then
      return jsonb_build_object('code', 'INVALID_PAYMENT');
    end if;
    v_pay_from := v_order.payment_status;
    update orders
    set payment_status = 'paid', updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
    values (v_order.id, v_pay_from, 'paid', 'payment_status', v_reason, v_actor);

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values (
      'mark_paid',
      'order',
      v_order.order_code,
      jsonb_build_object('from', v_pay_from, 'to', 'paid'),
      v_actor
    );
  end if;

  if p_order_status is not null then
    v_to := p_order_status;

    if v_to = v_from then
      return jsonb_build_object('code', 'INVALID_TRANSITION');
    end if;

    v_allowed := case v_from
      when 'pending' then v_to in ('confirmed', 'cancelled', 'expired')
      when 'awaiting_payment' then v_to in ('confirmed', 'cancelled', 'expired')
      when 'confirmed' then v_to in ('packing', 'cancelled')
      when 'packing' then v_to in ('shipping', 'cancelled')
      when 'shipping' then v_to in ('completed')
      else false
    end;

    if not v_allowed then
      return jsonb_build_object('code', 'INVALID_TRANSITION');
    end if;

    if v_to in ('cancelled', 'expired') and v_reason is null then
      return jsonb_build_object('code', 'REASON_REQUIRED', 'message', 'Hủy đơn bắt buộc nhập lý do.');
    end if;

    update orders
    set order_status = v_to, updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
    values (v_order.id, v_from, v_to, 'order_status', v_reason, v_actor);

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values (
      case when v_to in ('cancelled', 'expired') then 'cancel_order' else 'status_change' end,
      'order',
      v_order.order_code,
      jsonb_build_object('from', v_from, 'to', v_to, 'reason', v_reason),
      v_actor
    );

    if v_to in ('cancelled', 'expired') then
      update inventory_reservations
      set released_at = now()
      where order_id = v_order.id and released_at is null;

      update coupon_redemptions
      set released_at = now()
      where order_id = v_order.id and released_at is null;
    elsif v_to = 'completed' then
      for v_res in
        select ir.id, ir.variant_id, ir.quantity
        from inventory_reservations ir
        where ir.order_id = v_order.id and ir.released_at is null
        order by ir.variant_id
        for update of ir
      loop
        update inventory
        set quantity = greatest(quantity - v_res.quantity, 0),
            updated_at = now()
        where variant_id = v_res.variant_id;

        update inventory_reservations
        set released_at = now()
        where id = v_res.id;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order.order_code,
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status
  );
end;
$$;

-- New signature must be granted; drop old 3-arg overload if still present.
do $$
begin
  -- Keep single 5-arg function; PostgreSQL may keep old overload if arg counts differ.
  -- Drop previous 3-parameter version if exists.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_update_order'
      and pg_get_function_identity_arguments(p.oid) = 'p_order_code text, p_order_status text, p_payment_status text'
  ) then
    execute 'drop function public.admin_update_order(text, text, text)';
  end if;
exception when others then
  null;
end $$;

revoke all on function admin_update_order(text, text, text, text, text) from public;
revoke all on function admin_update_order(text, text, text, text, text) from anon, authenticated;
grant execute on function admin_update_order(text, text, text, text, text) to service_role;

create or replace function admin_list_orders(
  p_search text default null,
  p_order_status text default 'all',
  p_payment_status text default 'all',
  p_payment_method text default 'all',
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'created_at',
  p_sort_dir text default 'desc',
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page int := greatest(1, coalesce(p_page, 1));
  v_size int := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_offset int := (v_page - 1) * v_size;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_order_status text := coalesce(nullif(trim(p_order_status), ''), 'all');
  v_payment_status text := coalesce(nullif(trim(p_payment_status), ''), 'all');
  v_payment_method text := coalesce(nullif(trim(p_payment_method), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'created_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total int := 0;
  v_rows jsonb;
begin
  if v_sort not in ('created_at', 'total', 'updated_at') then v_sort := 'created_at'; end if;

  with filtered as (
    select
      o.order_code,
      o.customer_name,
      o.customer_phone,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.total,
      o.created_at,
      o.updated_at
    from orders o
    where
      (v_order_status = 'all' or o.order_status = v_order_status)
      and (v_payment_status = 'all' or o.payment_status = v_payment_status)
      and (v_payment_method = 'all' or o.payment_method = v_payment_method)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to)
      and (
        v_search is null
        or o.order_code ilike '%' || upper(v_search) || '%'
        or o.customer_name ilike '%' || v_search || '%'
        or o.customer_phone ilike '%' || v_search || '%'
      )
  )
  select count(*)::int into v_total from filtered;

  select coalesce(jsonb_agg(to_jsonb(x) - 'ord'), '[]'::jsonb)
  into v_rows
  from (
    select
      f.order_code as "orderCode",
      f.customer_name as "customerName",
      f.customer_phone as "customerPhone",
      f.payment_method as "paymentMethod",
      f.payment_status as "paymentStatus",
      f.order_status as "orderStatus",
      f.total,
      f.created_at as "createdAt",
      f.updated_at as "updatedAt",
      1 as ord
    from filtered f
    order by
      case when v_sort = 'total' and v_dir = 'asc' then f.total end asc nulls last,
      case when v_sort = 'total' and v_dir = 'desc' then f.total end desc nulls last,
      case when v_sort = 'updated_at' and v_dir = 'asc' then f.updated_at end asc nulls last,
      case when v_sort = 'updated_at' and v_dir = 'desc' then f.updated_at end desc nulls last,
      case when v_sort = 'created_at' and v_dir = 'asc' then f.created_at end asc nulls last,
      case when v_sort = 'created_at' and v_dir = 'desc' then f.created_at end desc nulls last,
      f.created_at desc
    offset v_offset
    limit v_size
  ) x;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'pageCount', case when v_total = 0 then 1 else ceil(v_total::numeric / v_size)::int end,
    'rows', v_rows
  );
end;
$$;

create or replace function admin_list_customers(
  p_search text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page int := greatest(1, coalesce(p_page, 1));
  v_size int := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_offset int := (v_page - 1) * v_size;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total int := 0;
  v_rows jsonb;
begin
  -- Aggregate from orders only (not full customer accounts).
  with agg as (
    select
      o.customer_phone as phone,
      (array_agg(o.customer_name order by o.created_at desc))[1] as name,
      (array_agg(o.customer_email order by o.created_at desc) filter (where o.customer_email is not null))[1] as email,
      count(*)::int as order_count,
      coalesce(sum(o.total) filter (where o.order_status not in ('cancelled', 'expired')), 0) as total_spent,
      max(o.created_at) as last_order_at,
      (array_agg(o.order_code order by o.created_at desc))[1] as last_order_code
    from orders o
    where
      v_search is null
      or o.customer_phone ilike '%' || v_search || '%'
      or o.customer_name ilike '%' || v_search || '%'
      or (o.customer_email is not null and o.customer_email ilike '%' || v_search || '%')
    group by o.customer_phone
  )
  select count(*)::int into v_total from agg;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', phone,
        'name', name,
        'phone', phone,
        'email', email,
        'orderCount', order_count,
        'totalSpent', total_spent,
        'lastOrderAt', last_order_at,
        'lastOrderCode', last_order_code
      )
      order by last_order_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select * from agg
    order by last_order_at desc
    offset v_offset
    limit v_size
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'pageCount', case when v_total = 0 then 1 else ceil(v_total::numeric / v_size)::int end,
    'rows', v_rows,
    'source', 'orders_aggregate'
  );
end;
$$;

create or replace function admin_add_order_note(
  p_order_code text,
  p_body text,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_note_id uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_actor text := coalesce(nullif(trim(p_actor_label), ''), 'admin');
begin
  if v_body = '' or char_length(v_body) > 2000 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select id into v_order_id from orders where order_code = upper(trim(p_order_code));
  if v_order_id is null then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;

  insert into order_internal_notes (order_id, body, actor_label)
  values (v_order_id, v_body, v_actor)
  returning id into v_note_id;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'internal_note',
    'order',
    upper(trim(p_order_code)),
    jsonb_build_object('noteId', v_note_id),
    v_actor
  );

  return jsonb_build_object('code', 'OK', 'noteId', v_note_id);
end;
$$;

revoke all on function admin_list_orders(text, text, text, text, timestamptz, timestamptz, text, text, int, int) from public;
revoke all on function admin_list_customers(text, int, int) from public;
revoke all on function admin_add_order_note(text, text, text) from public;
grant execute on function admin_list_orders(text, text, text, text, timestamptz, timestamptz, text, text, int, int) to service_role;
grant execute on function admin_list_customers(text, int, int) to service_role;
grant execute on function admin_add_order_note(text, text, text) to service_role;
