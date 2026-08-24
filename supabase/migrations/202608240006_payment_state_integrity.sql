-- VNPay settlement is idempotent only for the same gateway transaction and
-- may not revive an expired/cancelled order.

create unique index if not exists orders_payment_ref_unique_idx
  on orders (payment_ref)
  where payment_ref is not null;

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

  if v_order.payment_status <> 'pending'
     or v_order.payment_method <> 'vnpay'
     or v_order.order_status <> 'awaiting_payment' then
    return jsonb_build_object('code', 'ORDER_NOT_PAYABLE');
  end if;
  if v_order.transfer_expires_at is null or v_order.transfer_expires_at <= now() then
    return jsonb_build_object('code', 'ORDER_EXPIRED');
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
