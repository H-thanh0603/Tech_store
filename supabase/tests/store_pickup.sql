begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public'::name, 'stores'::name);
select has_table('public'::name, 'store_inventory'::name);
select has_table('public'::name, 'store_inventory_reservations'::name);
select has_function('public', 'available_store_stock', array['uuid', 'uuid']);
select has_function('public', 'pickup_stores_for_cart', array['text']);
select has_function('public', 'product_pickup_availability', array['uuid']);

insert into carts (id, token_hash)
values ('93000000-0000-4000-8000-000000000001', repeat('9', 64));

insert into cart_items (cart_id, variant_id, quantity, price_at_add)
select '93000000-0000-4000-8000-000000000001', v.id, 1,
  coalesce(v.sale_price, v.regular_price)
from product_variants v
where v.id = '40000000-0000-0000-0000-000000000001';

select ok(
  jsonb_array_length(pickup_stores_for_cart(repeat('9', 64))) > 0,
  'cart exposes a store that can fulfill every item'
);

create temp table pickup_before as
select quantity from store_inventory
where store_id = '92000000-0000-4000-8000-000000000001'
  and variant_id = '40000000-0000-0000-0000-000000000001';

select is(
  place_order(
    repeat('9', 64),
    '93000000-0000-4000-8000-000000000002',
    repeat('8', 64),
    jsonb_build_object(
      'customerName', 'Pickup Test',
      'customerPhone', '0901234567',
      'customerEmail', '',
      'note', '',
      'fulfillmentMethod', 'pickup',
      'pickupStoreId', '92000000-0000-4000-8000-000000000001'
    ),
    'cod',
    null
  )->>'code',
  'OK',
  'pickup checkout succeeds atomically'
);

select ok(
  exists (
    select 1 from orders o
    join store_inventory_reservations sir on sir.order_id = o.id
    where o.idempotency_key = '93000000-0000-4000-8000-000000000002'
      and o.fulfillment_method = 'pickup'
      and o.pickup_store_id = '92000000-0000-4000-8000-000000000001'
      and sir.released_at is null
  ),
  'pickup order stores its Store and active allocation reservation'
);

do $$
declare v_code text;
begin
  select order_code into v_code from orders
  where idempotency_key = '93000000-0000-4000-8000-000000000002';
  perform admin_update_order(v_code, 'confirmed', null, null, 'test');
  perform admin_update_order(v_code, 'packing', null, null, 'test');
  perform admin_update_order(v_code, 'shipping', null, null, 'test');
  perform admin_update_order(v_code, 'completed', null, null, 'test');
end $$;

select is(
  (select si.quantity from store_inventory si
   where si.store_id = '92000000-0000-4000-8000-000000000001'
     and si.variant_id = '40000000-0000-0000-0000-000000000001'),
  (select quantity - 1 from pickup_before),
  'completed pickup deducts the Store allocation exactly once'
);

rollback;
