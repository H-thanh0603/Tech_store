-- Keep Network Stock above every active checkout reservation, regardless of
-- which admin write path changes inventory.quantity.

create or replace function enforce_inventory_reservation_floor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_reserved integer;
begin
  select coalesce(sum(ir.quantity), 0)::integer
    into v_active_reserved
  from inventory_reservations ir
  join orders o on o.id = ir.order_id
  where ir.variant_id = new.variant_id
    and ir.released_at is null
    and (ir.expires_at is null or ir.expires_at > now())
    and o.order_status not in ('cancelled', 'expired');

  if new.quantity < new.reserved_quantity + v_active_reserved then
    raise exception using
      errcode = '23514',
      message = 'inventory quantity cannot be lower than active reservations';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_reservation_floor on inventory;
create trigger inventory_reservation_floor
before update of quantity, reserved_quantity on inventory
for each row execute function enforce_inventory_reservation_floor();

create or replace function admin_adjust_inventory(
  p_variant_id uuid,
  p_delta integer,
  p_reason_code text,
  p_note text default null,
  p_actor_label text default 'admin',
  p_expected_quantity integer default null,
  p_low_stock_threshold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv inventory%rowtype;
  v_prev integer;
  v_new integer;
  v_reserved integer;
  v_available integer;
  v_adj_id uuid;
begin
  if p_variant_id is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Thiếu variant.');
  end if;
  if p_delta is null or p_delta = 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Delta phải khác 0.');
  end if;
  if p_reason_code is null or p_reason_code not in (
    'restock', 'correction', 'damaged', 'returned', 'manual_adjustment'
  ) then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Reason code không hợp lệ.');
  end if;

  select * into v_inv
  from inventory
  where variant_id = p_variant_id
  for update;

  if not found then
    return jsonb_build_object('code', 'NOT_FOUND', 'message', 'Không tìm thấy tồn kho.');
  end if;

  if p_expected_quantity is not null and v_inv.quantity <> p_expected_quantity then
    return jsonb_build_object(
      'code', 'CONFLICT',
      'message', 'Tồn kho đã thay đổi. Tải lại và thử lại.',
      'currentQuantity', v_inv.quantity
    );
  end if;

  select v_inv.reserved_quantity + coalesce(sum(ir.quantity), 0)::integer
    into v_reserved
  from inventory_reservations ir
  join orders o on o.id = ir.order_id
  where ir.variant_id = p_variant_id
    and ir.released_at is null
    and (ir.expires_at is null or ir.expires_at > now())
    and o.order_status not in ('cancelled', 'expired');

  v_reserved := coalesce(v_reserved, v_inv.reserved_quantity);
  v_prev := v_inv.quantity;
  v_new := v_prev + p_delta;
  v_available := v_new - v_reserved;

  if v_new < 0 or v_available < 0 then
    return jsonb_build_object(
      'code', 'STOCK_CONSTRAINT',
      'message', 'Tồn khả dụng không được âm (còn hàng đang giữ chỗ).'
    );
  end if;

  update inventory
  set quantity = v_new,
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
      updated_at = now()
  where id = v_inv.id
  returning * into v_inv;

  insert into inventory_adjustments (
    inventory_id, variant_id, previous_quantity, delta, new_quantity,
    reason_code, note, actor_label
  ) values (
    v_inv.id, p_variant_id, v_prev, p_delta, v_new,
    p_reason_code,
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(nullif(trim(p_actor_label), ''), 'admin')
  )
  returning id into v_adj_id;

  return jsonb_build_object(
    'code', 'OK',
    'adjustmentId', v_adj_id,
    'previousQuantity', v_prev,
    'delta', p_delta,
    'newQuantity', v_new,
    'reservedQuantity', v_reserved,
    'available', v_available,
    'lowStockThreshold', v_inv.low_stock_threshold
  );
end;
$$;

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
  v_on_hand integer;
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

  -- Validate the complete request before performing either payment or order writes.
  if p_payment_status is not null then
    if p_payment_status <> 'paid' or v_order.payment_status <> 'pending' then
      return jsonb_build_object('code', 'INVALID_PAYMENT');
    end if;
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

    if v_to = 'completed' then
      for v_res in
        select ir.id, ir.variant_id, ir.quantity
        from inventory_reservations ir
        where ir.order_id = v_order.id and ir.released_at is null
        order by ir.variant_id
        for update of ir
      loop
        select quantity into v_on_hand
        from inventory
        where variant_id = v_res.variant_id
        for update;

        if not found or v_on_hand < v_res.quantity then
          return jsonb_build_object('code', 'STOCK_CONSTRAINT');
        end if;
      end loop;
    end if;
  end if;

  if p_payment_status is not null then
    v_pay_from := v_order.payment_status;
    update orders
    set payment_status = 'paid', updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
    values (v_order.id, v_pay_from, 'paid', 'payment_status', v_reason, v_actor);

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values (
      'mark_paid', 'order', v_order.order_code,
      jsonb_build_object('from', v_pay_from, 'to', 'paid'), v_actor
    );
  end if;

  if p_order_status is not null then
    update orders
    set order_status = v_to, updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
    values (v_order.id, v_from, v_to, 'order_status', v_reason, v_actor);

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values (
      case when v_to in ('cancelled', 'expired') then 'cancel_order' else 'status_change' end,
      'order', v_order.order_code,
      jsonb_build_object('from', v_from, 'to', v_to, 'reason', v_reason), v_actor
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
        -- Release first inside this transaction so the inventory floor trigger
        -- checks the remaining reservations. Any later failure rolls both back.
        update inventory_reservations
        set released_at = now()
        where id = v_res.id;

        update inventory
        set quantity = quantity - v_res.quantity,
            updated_at = now()
        where variant_id = v_res.variant_id;
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

revoke all on function enforce_inventory_reservation_floor() from public, anon, authenticated;
