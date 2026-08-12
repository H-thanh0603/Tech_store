-- Phase 2: Inventory & Reservation Correctness

-- 1. Create a function to explicitly expire old pending reservations
create or replace function public.expire_pending_orders(p_expiry_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer := 0;
begin
  -- Lock orders that are pending and older than expiry
  with expired_orders as (
    select id
    from orders
    where order_status = 'pending'
      and created_at < now() - (p_expiry_minutes || ' minutes')::interval
    for update skip locked
  ),
  updated_orders as (
    update orders
    set order_status = 'expired',
        updated_at = now()
    where id in (select id from expired_orders)
    returning id
  ),
  -- Also update inventory_reservations
  released_reservations as (
    update inventory_reservations
    set released_at = now()
    where order_id in (select id from updated_orders)
      and released_at is null
    returning order_id
  )
  select count(*) into v_expired_count from updated_orders;
  
  return v_expired_count;
end;
$$;

-- 2. Ensure available_variant_stock is the single source of truth
-- Note: we ignore inventory.reserved_quantity and calculate purely from reservations
create or replace function available_variant_stock(p_variant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    inv.quantity - coalesce((
      select sum(ir.quantity)
      from inventory_reservations ir
      join orders o on o.id = ir.order_id
      where ir.variant_id = p_variant_id
        and ir.released_at is null
        and o.order_status not in ('cancelled', 'expired', 'failed')
    ), 0),
    0
  )::integer
  from inventory inv
  where inv.variant_id = p_variant_id;
$$;

-- 3. Maintain inventory.reserved_quantity accurately via triggers
create or replace function maintain_inventory_reserved_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer;
  v_variant_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_variant_id := NEW.variant_id;
  elsif TG_OP = 'UPDATE' then
    v_variant_id := NEW.variant_id;
  elsif TG_OP = 'DELETE' then
    v_variant_id := OLD.variant_id;
  end if;

  select coalesce(sum(ir.quantity), 0) into v_reserved
  from inventory_reservations ir
  join orders o on o.id = ir.order_id
  where ir.variant_id = v_variant_id
    and ir.released_at is null
    and o.order_status not in ('cancelled', 'expired', 'failed');

  update inventory
  set reserved_quantity = v_reserved
  where variant_id = v_variant_id;

  return null;
end;
$$;

drop trigger if exists sync_inventory_reservations on inventory_reservations;
create trigger sync_inventory_reservations
after insert or update or delete on inventory_reservations
for each row execute function maintain_inventory_reserved_quantity();

create or replace function trigger_sync_inventory_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant_record record;
begin
  if NEW.order_status is distinct from OLD.order_status then
    for v_variant_record in (select variant_id from inventory_reservations where order_id = NEW.id) loop
      update inventory
      set reserved_quantity = (
        select coalesce(sum(ir.quantity), 0)
        from inventory_reservations ir
        join orders o on o.id = ir.order_id
        where ir.variant_id = v_variant_record.variant_id
          and ir.released_at is null
          and o.order_status not in ('cancelled', 'expired', 'failed')
      )
      where variant_id = v_variant_record.variant_id;
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_inventory_from_order on orders;
create trigger sync_inventory_from_order
after update of order_status on orders
for each row execute function trigger_sync_inventory_from_order();

-- 4. Fix admin_update_order inventory fulfillment logic to avoid hiding overselling
drop function if exists admin_update_order(text, text, text, text, text);
create or replace function admin_update_order(
  p_order_code text,
  p_payment_status text default null,
  p_order_status text default null,
  p_reason text default null,
  p_actor text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_from text;
  v_to text;
  v_allowed boolean;
  v_res record;
  v_current_inventory integer;
begin
  select * into v_order from orders where order_code = p_order_code for update;
  
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;

  if p_payment_status is not null and p_payment_status is distinct from v_order.payment_status then
    update orders 
    set payment_status = p_payment_status, updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values ('payment_status_change', 'order', v_order.order_code, jsonb_build_object('from', v_order.payment_status, 'to', p_payment_status), p_actor);
  end if;

  if p_order_status is not null then
    v_from := v_order.order_status;
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

    if v_to in ('cancelled', 'expired') and p_reason is null then
      return jsonb_build_object('code', 'REASON_REQUIRED', 'message', 'Hủy đơn bắt buộc nhập lý do.');
    end if;

    -- Inventory invariant check before completing
    if v_to = 'completed' then
      for v_res in
        select ir.id, ir.variant_id, ir.quantity, ir.expires_at
        from inventory_reservations ir
        where ir.order_id = v_order.id and ir.released_at is null
        order by ir.variant_id
        for update of ir
      loop
        -- Check expiry
        if v_res.expires_at is not null and v_res.expires_at <= now() then
          return jsonb_build_object('code', 'RESERVATION_EXPIRED', 'message', 'Reservation expired');
        end if;

        -- Lock inventory row
        select quantity into v_current_inventory from inventory where variant_id = v_res.variant_id for update;

        -- Verify stock invariant
        if v_current_inventory < v_res.quantity then
          return jsonb_build_object('code', 'INVENTORY_SHORTAGE', 'message', 'Không đủ tồn kho thực tế để hoàn tất đơn hàng.');
        end if;

        -- Safe deduction
        update inventory
        set quantity = quantity - v_res.quantity,
            updated_at = now()
        where variant_id = v_res.variant_id;

        update inventory_reservations
        set released_at = now()
        where id = v_res.id;
      end loop;
    elsif v_to in ('cancelled', 'expired') then
      update inventory_reservations
      set released_at = now()
      where order_id = v_order.id and released_at is null;

      update coupon_redemptions
      set released_at = now()
      where order_id = v_order.id and released_at is null;
    end if;

    update orders
    set order_status = v_to, updated_at = now()
    where id = v_order.id
    returning * into v_order;

    insert into order_status_events (order_id, from_status, to_status, event_type, reason, actor_label)
    values (v_order.id, v_from, v_to, 'order_status', p_reason, p_actor);

    insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
    values (
      case when v_to in ('cancelled', 'expired') then 'cancel_order' else 'status_change' end,
      'order',
      v_order.order_code,
      jsonb_build_object('from', v_from, 'to', v_to, 'reason', p_reason),
      p_actor
    );
  end if;

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order.order_code,
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status
  );
end;
$$;
