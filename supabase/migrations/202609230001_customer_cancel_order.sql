-- Customer self-cancel: guests cancel their own order before fulfillment.
-- Scoped by order code + phone digits + access-token hash (same trust
-- boundary as request_order_return). Only unpaid, pre-fulfillment orders
-- (pending / awaiting_payment / confirmed) are cancellable; paid orders need
-- manual refund triage so money is never dropped silently.
-- Cancelling releases inventory reservations + coupon redemptions, mirroring
-- admin_update_order's cancelled path, and leaves order_status_events +
-- admin_audit_logs trails (actor 'customer').

create or replace function customer_cancel_order(
  p_order_code text,
  p_access_token_hash text,
  p_phone text,
  p_reason text default null
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
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_access_token_hash !~ '^[a-f0-9]{64}$' then
    return v_not_found;
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Rate limit: 3 attempts / 15m per access token (same shape as return_request).
  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('order_cancel', p_access_token_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;
  if v_attempts > 3 then
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
    and access_token_hash = p_access_token_hash
  for update;
  if not found then
    return v_not_found;
  end if;

  if v_order.order_status not in ('pending', 'awaiting_payment', 'confirmed') then
    return jsonb_build_object('code', 'NOT_CANCELLABLE');
  end if;
  -- Paid orders go through manual refund triage (payment_refunds ledger),
  -- never a silent self-cancel.
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('code', 'NOT_CANCELLABLE');
  end if;

  update orders
  set order_status = 'cancelled', updated_at = now()
  where id = v_order.id;

  update inventory_reservations
  set released_at = now()
  where order_id = v_order.id and released_at is null;

  update coupon_redemptions
  set released_at = now()
  where order_id = v_order.id and released_at is null;

  insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
  values (v_order.id, v_order.order_status, 'cancelled', 'order_status',
    coalesce(v_reason, 'customer_cancelled'), 'customer');

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'cancel_order', 'order', v_order.order_code,
    jsonb_build_object('from', v_order.order_status, 'to', 'cancelled',
      'reason', coalesce(v_reason, 'customer_cancelled')),
    'customer'
  );

  return jsonb_build_object('code', 'OK', 'orderCode', v_order.order_code);
end;
$$;

revoke all on function customer_cancel_order(text, text, text, text) from public;
revoke all on function customer_cancel_order(text, text, text, text) from anon, authenticated;
grant execute on function customer_cancel_order(text, text, text, text) to anon, authenticated;
