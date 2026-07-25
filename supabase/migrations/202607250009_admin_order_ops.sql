-- Staff order operations: status transitions with stock release / sale deduction.
-- Invoked only via service-role from Next.js admin Server Actions (not granted to anon).

create or replace function admin_update_order(
  p_order_code text,
  p_order_status text default null,
  p_payment_status text default null
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
    update orders
    set payment_status = 'paid', updated_at = now()
    where id = v_order.id
    returning * into v_order;
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

    update orders
    set order_status = v_to, updated_at = now()
    where id = v_order.id
    returning * into v_order;

    if v_to in ('cancelled', 'expired') then
      update inventory_reservations
      set released_at = now()
      where order_id = v_order.id and released_at is null;

      update coupon_redemptions
      set released_at = now()
      where order_id = v_order.id and released_at is null;
    elsif v_to = 'completed' then
      -- Convert open reservations into permanent stock deduction, then release.
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

revoke all on function admin_update_order(text, text, text) from public;
revoke all on function admin_update_order(text, text, text) from anon, authenticated;
-- Only service_role (server admin client) may execute this RPC.
grant execute on function admin_update_order(text, text, text) to service_role;
