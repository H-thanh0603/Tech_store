-- Forward-fix for regressions introduced by 202608270002_shipping_rates.sql.
--
-- That migration applied (Supabase CLI runs migrations with
-- check_function_bodies = off) but contained three defects:
--
-- 1. It created a 5-arg overload of place_order_internal that references
--    objects that do not exist (carts.expires_at, order_status/payment_status
--    enum casts, orders.province/district/ward, inventory_reservations.cart_id).
--    Nothing calls it — the public wrapper uses the 7-arg body from
--    202608250012 — but as a SECURITY DEFINER function with default PUBLIC
--    execute it is a landmine: executed, it would also release reservations
--    per cart, defeating the oversell model. Drop it.
--
-- 2. It rewrote order_get_by_access from SECURITY DEFINER (202608240004) to a
--    SECURITY INVOKER SQL function. anon/authenticated have no grants on
--    orders/order_items, so every guest call fails with 42501 and the order
--    confirmation / detail pages render notFound(). It also dropped the
--    fulfillmentMethod/pickupStore fields the storefront requires
--    (lib/commerce/types.ts OrderConfirmationData). Restore the definer
--    plpgsql body, keeping the shipping_total fix and customerPhone, and
--    re-adding the pickup fields.
--
-- 3. calculate_shipping stayed SECURITY INVOKER with no SELECT grant on
--    shipping_rates for anon/authenticated, so storefront shipping
--    calculation returned null. Make it SECURITY DEFINER (it only reads the
--    active rate row) and grant the table read that the existing RLS policy
--    ("Public can view active shipping rates") was written for.

-- 1. Remove the broken 5-arg place_order_internal overload (7-arg body from
--    202608250012 is the only valid one and remains untouched).
drop function if exists place_order_internal(text, text, jsonb, text, text);

-- 2. order_get_by_access: SECURITY DEFINER again, full contract.
create or replace function order_get_by_access(
  p_order_code text,
  p_access_token_hash text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_items jsonb;
  v_store stores%rowtype;
begin
  if p_order_code is null or p_access_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;

  select * into v_order from orders
  where order_code = upper(trim(p_order_code)) and access_token_hash = p_access_token_hash;
  if not found then return jsonb_build_object('code', 'ORDER_NOT_FOUND'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', product_name, 'sku', sku, 'attributes', attributes,
    'unitPrice', unit_price, 'quantity', quantity, 'lineTotal', line_total
  ) order by id), '[]'::jsonb)
  into v_items from order_items where order_id = v_order.id;

  if v_order.pickup_store_id is not null then
    select * into v_store from stores where id = v_order.pickup_store_id;
  end if;

  return jsonb_build_object(
    'code', 'OK', 'orderCode', v_order.order_code,
    'customerPhone', regexp_replace(v_order.customer_phone, '\D', '', 'g'),
    'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'orderStatus', v_order.order_status, 'subtotal', v_order.subtotal,
    'discountTotal', v_order.discount_total, 'shippingTotal', v_order.shipping_total,
    'total', v_order.total,
    'transferExpiresAt', v_order.transfer_expires_at, 'items', v_items,
    'fulfillmentMethod', v_order.fulfillment_method,
    'pickupStore', case when v_order.pickup_store_id is null then null else jsonb_build_object(
      'id', v_store.id, 'name', v_store.name, 'phone', v_store.phone,
      'address', v_store.street_address, 'district', v_store.district,
      'province', v_store.province, 'openingHours', v_store.opening_hours
    ) end
  );
end;
$$;

revoke all on function order_get_by_access(text, text) from public;
grant execute on function order_get_by_access(text, text) to anon, authenticated;

-- 3. calculate_shipping: definer (reads the active rate row only) + the
--    missing table grant for the RLS policy to be reachable directly.
create or replace function calculate_shipping(
  p_subtotal numeric,
  p_item_count int
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'shippingTotal', case
      when sr.free_threshold > 0 and p_subtotal >= sr.free_threshold then 0
      else sr.base_rate + (sr.per_item_rate * greatest(p_item_count - 1, 0))
    end,
    'rateName', sr.name,
    'freeThreshold', sr.free_threshold,
    'baseRate', sr.base_rate,
    'perItemRate', sr.per_item_rate,
    'isFree', case
      when sr.free_threshold > 0 and p_subtotal >= sr.free_threshold then true
      else false
    end
  )
  from shipping_rates sr
  where sr.is_active = true
  order by sr.created_at asc
  limit 1;
$$;

revoke all on function calculate_shipping(numeric, int) from public;
grant execute on function calculate_shipping(numeric, int) to anon, authenticated;

grant select on shipping_rates to anon, authenticated;
