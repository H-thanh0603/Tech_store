-- API-001: a valid VNPay payment arriving after expiry no longer strands the
-- customer's money on a manual-refund path. Two late-payment cases:
--
-- 1. Cron race: order still awaiting_payment/pending but transfer_expires_at
--    just passed (sweeper runs every 5 min). Accept the money: extend expiry,
--    mark paid, keep awaiting_payment for the normal confirm flow.
-- 2. Already expired: the sweeper marked expired/expired and released
--    reservations/coupons. Reopen to confirmed + paid with a fresh expiry so
--    the order surfaces in the ops queue instead of dying silently. Ops still
--    verifies stock before packing (reservations were released); the IPN
--    caller logs an audit row for this path.
--
-- Both return code REOPENED (with reopened_from_expired true only for case 2)
-- so VNPay stops retrying the IPN. ORDER_EXPIRED is kept as a defensive
-- fallback and is no longer reachable through either path.

create or replace function order_mark_paid_by_gateway(
  p_order_code text,
  p_vnp_transaction_no text,
  p_vnp_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_transaction_no text := nullif(trim(coalesce(p_vnp_transaction_no, '')), '');
begin
  if p_order_code is null or trim(p_order_code) = ''
     or v_transaction_no is null
     or p_vnp_amount is null
     or p_vnp_amount <= 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
  for update;

  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  if v_order.total * 100 <> p_vnp_amount then
    return jsonb_build_object('code', 'AMOUNT_MISMATCH');
  end if;

  if v_order.payment_status = 'paid' then
    if v_order.payment_ref = v_transaction_no then
      return jsonb_build_object('code', 'ALREADY_PAID');
    end if;
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end if;

  -- Case 2: sweeper already expired the order; money arrived late.
  if v_order.order_status = 'expired'
     and v_order.payment_status = 'expired'
     and v_order.payment_method = 'vnpay' then
    if exists (
      select 1 from orders
      where payment_ref = v_transaction_no and id <> v_order.id
    ) then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end if;

    begin
      update orders
      set order_status = 'confirmed',
          payment_status = 'paid',
          payment_ref = v_transaction_no,
          transfer_expires_at = now() + interval '24 hours',
          updated_at = now()
      where id = v_order.id;
    exception when unique_violation then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end;

    insert into order_status_events (order_id, event_type, from_status, to_status, reason)
    values
      (v_order.id, 'order_status', 'expired', 'confirmed', 'late_vnpay_reopen'),
      (v_order.id, 'payment_status', 'expired', 'paid', 'late_vnpay_reopen');

    return jsonb_build_object(
      'code', 'REOPENED',
      'orderCode', v_order.order_code,
      'paymentStatus', 'paid',
      'paymentRef', v_transaction_no,
      'reopenedFromExpired', true
    );
  end if;

  if v_order.payment_status <> 'pending'
     or v_order.payment_method <> 'vnpay'
     or v_order.order_status <> 'awaiting_payment' then
    return jsonb_build_object('code', 'ORDER_NOT_PAYABLE');
  end if;

  -- Case 1: still awaiting payment but past expiry (cron race). Accept the
  -- late money and extend the window so the sweeper leaves it alone.
  if v_order.transfer_expires_at is null or v_order.transfer_expires_at <= now() then
    if exists (
      select 1 from orders
      where payment_ref = v_transaction_no and id <> v_order.id
    ) then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end if;

    begin
      update orders
      set payment_status = 'paid',
          payment_ref = v_transaction_no,
          transfer_expires_at = now() + interval '24 hours',
          updated_at = now()
      where id = v_order.id;
    exception when unique_violation then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end;

    insert into order_status_events (order_id, event_type, from_status, to_status, reason)
    values (v_order.id, 'payment_status', 'pending', 'paid', 'late_vnpay_accepted');

    return jsonb_build_object(
      'code', 'REOPENED',
      'orderCode', v_order.order_code,
      'paymentStatus', 'paid',
      'paymentRef', v_transaction_no,
      'reopenedFromExpired', false
    );
  end if;

  if exists (
    select 1 from orders
    where payment_ref = v_transaction_no and id <> v_order.id
  ) then
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end if;

  begin
    update orders
    set payment_status = 'paid',
        payment_ref = v_transaction_no,
        updated_at = now()
    where id = v_order.id;
  exception when unique_violation then
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end;

  insert into order_status_events (order_id, event_type, from_status, to_status)
  values (v_order.id, 'payment_status', v_order.payment_status, 'paid');

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order.order_code,
    'paymentStatus', 'paid',
    'paymentRef', v_transaction_no
  );
end;
$$;

revoke all on function order_mark_paid_by_gateway(text, text, bigint) from public;
revoke all on function order_mark_paid_by_gateway(text, text, bigint) from anon, authenticated;
grant execute on function order_mark_paid_by_gateway(text, text, bigint) to service_role;
