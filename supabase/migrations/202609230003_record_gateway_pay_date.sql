-- Record when a gateway payment settled + the gateway's own pay timestamp
-- (VNPay vnp_PayDate). The refund API requires vnp_TransactionDate = the
-- ORIGINAL pay date, so without persisting it every refund needs the ops
-- human to copy the date from the VNPay dashboard by hand.

alter table orders
  add column if not exists paid_at timestamptz,
  add column if not exists gateway_pay_date text
    check (gateway_pay_date is null or gateway_pay_date ~ '^[0-9]{14}$');

create or replace function order_mark_paid_by_gateway(
  p_order_code text,
  p_vnp_transaction_no text,
  p_vnp_amount bigint,
  p_vnp_pay_date text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_transaction_no text := nullif(trim(coalesce(p_vnp_transaction_no, '')), '');
  v_pay_date text := nullif(trim(coalesce(p_vnp_pay_date, '')), '');
  v_line record;
  v_avail integer;
begin
  if p_order_code is null or trim(p_order_code) = ''
     or v_transaction_no is null
     or p_vnp_amount is null
     or p_vnp_amount <= 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if v_pay_date is not null and v_pay_date !~ '^[0-9]{14}$' then
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

    for v_line in
      select oi.variant_id, oi.quantity
      from order_items oi
      where oi.order_id = v_order.id
    loop
      perform pg_advisory_xact_lock(hashtext('variant:' || v_line.variant_id::text));
      v_avail := available_variant_stock(v_line.variant_id);
      if v_avail < v_line.quantity then
        insert into order_status_events (order_id, event_type, from_status, to_status, reason)
        values (v_order.id, 'payment_status', 'expired', 'expired', 'late_vnpay_insufficient_stock');
        return jsonb_build_object('code', 'OUT_OF_STOCK', 'orderCode', v_order.order_code);
      end if;
    end loop;

    begin
      update orders
      set order_status = 'confirmed',
          payment_status = 'paid',
          payment_ref = v_transaction_no,
          paid_at = now(),
          gateway_pay_date = coalesce(v_pay_date, gateway_pay_date),
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
          paid_at = now(),
          gateway_pay_date = coalesce(v_pay_date, gateway_pay_date),
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
        paid_at = now(),
        gateway_pay_date = coalesce(v_pay_date, gateway_pay_date),
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

revoke all on function order_mark_paid_by_gateway(text, text, bigint, text) from public;
revoke all on function order_mark_paid_by_gateway(text, text, bigint, text) from anon, authenticated;
grant execute on function order_mark_paid_by_gateway(text, text, bigint, text) to service_role;
