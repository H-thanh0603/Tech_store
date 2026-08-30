-- Return / refund workflow.
--
-- A small electronics shop cannot operate without a return policy, but
-- the commerce schema had no return state at all: once an order reached
-- 'completed' or 'cancelled' nothing else could happen.
--
-- Design:
--   * Two new order statuses: 'return_requested' (customer asked) and
--     'returned' (goods back in shop; refund may or may not be done
--     yet depending on payment method).
--   * order_returns holds the request rows with reason, customer note,
--     admin decision, and refund amounts.
--   * request_order_return: callable by the customer via their order
--     access token hash (same trust boundary as order_get_by_access),
--     rate-limited, only from 'completed' or 'shipping' orders.
--   * admin_decide_return: admin-only; approve/reject; on approve it
--     moves the order to 'returned', restocks every item with the
--     existing 'returned' inventory reason, and optionally records a
--     refund amount (VNPay refund execution is out of scope — the shop
--     refunds manually through its gateway dashboard and records it).

-- 1) Extend the order_status check constraint.
alter table orders drop constraint orders_order_status_check;
alter table orders add constraint orders_order_status_check check (
  order_status in (
    'pending', 'awaiting_payment', 'confirmed', 'packing',
    'shipping', 'completed', 'cancelled', 'expired',
    'return_requested', 'returned'
  )
);

-- 2) Return request rows.
create table order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  requested_by_phone text not null,
  reason_code text not null check (
    reason_code in ('defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other')
  ),
  customer_note text check (length(coalesce(customer_note, '')) <= 1000),
  status text not null default 'requested' check (
    status in ('requested', 'approved', 'rejected')
  ),
  admin_note text check (length(coalesce(admin_note, '')) <= 1000),
  refund_amount numeric(12, 2) check (refund_amount is null or refund_amount >= 0),
  decided_at timestamptz,
  decided_by_label text,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index order_returns_order_id_idx on order_returns (order_id);
create index order_returns_status_idx on order_returns (status, created_at desc);

alter table order_returns enable row level security;
-- Only service role (admin backend) reads/writes return rows; customers
-- act through the request_order_return RPC with their access token.

-- 3) Customer-facing request function (same token trust boundary as
--    order_get_by_access; rate limited 2 requests / 15 minutes).
create or replace function request_order_return(
  p_order_code text,
  p_access_token_hash text,
  p_phone text,
  p_reason_code text,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_not_found constant jsonb := jsonb_build_object('code', 'ORDER_NOT_FOUND');
  v_bucket timestamptz;
  v_attempts integer;
  v_phone_digits text;
begin
  if p_access_token_hash !~ '^[a-f0-9]{64}$' then
    return v_not_found;
  end if;
  if p_reason_code not in ('defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other') then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if p_customer_note is not null and length(p_customer_note) > 1000 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Rate limit: keyed on the caller's identity hash (cart token).
  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('return_request', p_access_token_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;
  if v_attempts > 2 then
    return jsonb_build_object('code', 'RATE_LIMITED');
  end if;

  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_digits = '' then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
    and regexp_replace(customer_phone, '\D', '', 'g') = v_phone_digits
    and access_token_hash = p_access_token_hash;
  if not found then
    return v_not_found;
  end if;

  if v_order.order_status not in ('shipping', 'completed') then
    return jsonb_build_object('code', 'NOT_RETURNABLE');
  end if;

  if exists (select 1 from order_returns where order_id = v_order.id) then
    return jsonb_build_object('code', 'RETURN_ALREADY_REQUESTED');
  end if;

  insert into order_returns (order_id, requested_by_phone, reason_code, customer_note)
  values (v_order.id, v_order.customer_phone, p_reason_code, p_customer_note);

  update orders set order_status = 'return_requested', updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('code', 'OK', 'orderCode', v_order.order_code);
end;
$$;

revoke all on function request_order_return(text, text, text, text, text) from public;
grant execute on function request_order_return(text, text, text, text, text) to anon, authenticated;

-- 4) Admin decision function.
create or replace function admin_decide_return(
  p_return_id uuid,
  p_approve boolean,
  p_admin_note text default null,
  p_refund_amount numeric default null,
  p_actor_label text default 'admin',
  p_restock boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_return order_returns%rowtype;
  v_order orders%rowtype;
  v_item record;
  v_inv inventory%rowtype;
  v_prev int;
begin
  select * into v_return from order_returns where id = p_return_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND', 'message', 'Không tìm thấy yêu cầu trả hàng.');
  end if;
  if v_return.status <> 'requested' then
    return jsonb_build_object('code', 'ALREADY_DECIDED', 'message', 'Yêu cầu này đã được xử lý.');
  end if;

  select * into v_order from orders where id = v_return.order_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;

  if p_approve then
    update order_returns
    set status = 'approved',
        admin_note = p_admin_note,
        refund_amount = p_refund_amount,
        decided_at = now(),
        decided_by_label = coalesce(p_actor_label, 'admin')
    where id = v_return.id;

    update orders
    set order_status = 'returned', updated_at = now()
    where id = v_return.order_id;

    if coalesce(p_restock, true) then
      for v_item in
        select oi.variant_id, oi.quantity
        from order_items oi
        where oi.order_id = v_return.order_id and oi.variant_id is not null
      loop
        select * into v_inv
        from inventory
        where variant_id = v_item.variant_id
        for update;
        if found then
          v_prev := v_inv.quantity;
          update inventory
          set quantity = v_inv.quantity + v_item.quantity, updated_at = now()
          where id = v_inv.id;
          insert into inventory_adjustments (
            inventory_id, variant_id, previous_quantity, delta, new_quantity,
            reason_code, note, actor_label
          ) values (
            v_inv.id, v_item.variant_id, v_prev, v_item.quantity, v_prev + v_item.quantity,
            'returned', 'auto: order return ' || v_order.order_code, coalesce(p_actor_label, 'admin')
          );
        end if;
      end loop;
    end if;
  else
    update order_returns
    set status = 'rejected',
        admin_note = p_admin_note,
        decided_at = now(),
        decided_by_label = coalesce(p_actor_label, 'admin')
    where id = v_return.id;

    -- Order goes back to where it was before the customer asked.
    update orders
    set order_status = 'completed', updated_at = now()
    where id = v_return.order_id;
  end if;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'return_decision',
    'order',
    v_return.order_id::text,
    jsonb_build_object(
      'approve', p_approve,
      'refundAmount', p_refund_amount,
      'restock', p_restock,
      'reason', v_return.reason_code,
      'orderCode', v_order.order_code
    ),
    coalesce(p_actor_label, 'admin')
  );

  return jsonb_build_object(
    'code', 'OK',
    'returnId', v_return.id,
    'orderCode', v_order.order_code,
    'approved', p_approve
  );
end;
$$;

revoke execute on function admin_decide_return(uuid, boolean, text, numeric, text, boolean) from public, anon, authenticated;
grant execute on function admin_decide_return(uuid, boolean, text, numeric, text, boolean) to service_role;

-- 5) Admin list of pending returns.
create or replace function admin_list_returns(
  p_status text default 'requested',
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'total', count(*) over (),
    'page', greatest(coalesce(p_page, 1), 1),
    'pageSize', least(greatest(coalesce(p_page_size, 20), 1), 100),
    'rows', coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  )
  from (
    select
      r.id, r.order_id, r.reason_code, r.customer_note, r.status,
      r.admin_note, r.refund_amount, r.decided_at, r.decided_by_label,
      r.created_at, r.requested_by_phone,
      o.order_code, o.total as order_total, o.order_status, o.payment_method, o.payment_status,
      (o.customer_name) as customer_name,
      (select count(*) from order_items oi where oi.order_id = o.id) as item_count
    from order_returns r
    join orders o on o.id = r.order_id
    where p_status = 'all' or r.status = p_status
    order by r.created_at desc
    limit least(greatest(coalesce(p_page_size, 20), 1), 100)
    offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 100)
  ) t;
$$;

revoke execute on function admin_list_returns(text, int, int) from public, anon, authenticated;
grant execute on function admin_list_returns(text, int, int) to service_role;
