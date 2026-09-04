-- DB-014: rejecting a return always reset the order to 'completed', even when
-- the request came from a 'shipping' order (skipping its real state).
-- The pre-request status is now stored on order_returns and restored on
-- reject. Existing rows backfill to 'completed' (previous behavior).

alter table order_returns
  add column if not exists previous_order_status text;

update order_returns
set previous_order_status = 'completed'
where previous_order_status is null;

-- request_order_return: same body as 202609030005 plus the status snapshot.
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
  v_return_id uuid;
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

  -- Duplicate check first: once a request exists the order sits in
  -- return_requested, and reporting NOT_RETURNABLE for a repeat call
  -- would mask the real reason (already requested).
  if exists (select 1 from order_returns where order_id = v_order.id) then
    return jsonb_build_object('code', 'RETURN_ALREADY_REQUESTED');
  end if;

  if v_order.order_status not in ('shipping', 'completed') then
    return jsonb_build_object('code', 'NOT_RETURNABLE');
  end if;

  -- The EXISTS guard above cannot win a race: two concurrent callers both
  -- pass it, and the loser must get a code, not a 500 from unique(order_id).
  insert into order_returns (
    order_id, requested_by_phone, reason_code, customer_note,
    previous_order_status
  )
  values (
    v_order.id, v_order.customer_phone, p_reason_code, p_customer_note,
    v_order.order_status
  )
  on conflict (order_id) do nothing
  returning id into v_return_id;
  if not found then
    return jsonb_build_object('code', 'RETURN_ALREADY_REQUESTED');
  end if;

  update orders set order_status = 'return_requested', updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('code', 'OK', 'orderCode', v_order.order_code);
end;
$$;

revoke all on function request_order_return(text, text, text, text, text) from public;
grant execute on function request_order_return(text, text, text, text, text) to anon, authenticated;

-- admin_decide_return: reject restores the pre-request status instead of
-- hard-coding 'completed'. Identical to 202608300001 except the reject path.
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
  v_restore text;
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

    -- A returned order is treated as if the transaction never happened:
    -- release the coupon redemption so one-shot coupons get their quota
    -- back for the customer's next attempt.
    update coupon_redemptions
    set released_at = now()
    where order_id = v_return.order_id and released_at is null;

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

    -- Order goes back to where it was before the customer asked. Only
    -- shipping/completed can reach here (enforced at request time); anything
    -- else falls back to completed for legacy rows.
    v_restore := case
      when v_return.previous_order_status in ('shipping', 'completed')
      then v_return.previous_order_status
      else 'completed'
    end;
    update orders
    set order_status = v_restore, updated_at = now()
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
