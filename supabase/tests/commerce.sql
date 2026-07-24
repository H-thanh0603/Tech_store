-- pgTAP tests for the M3 commerce schema: table/function/view existence,
-- RLS enablement, constraint enforcement, and the reservation-aware stock
-- helper. RPC behavior (cart, order, coupon, tracking) is asserted in later
-- sections as those migrations land. Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- Schema existence -----------------------------------------------------------

select has_table('public', 'carts', 'carts table exists');
select has_table('public', 'cart_items', 'cart_items table exists');
select has_table('public', 'coupons', 'coupons table exists');
select has_table('public', 'coupon_redemptions', 'coupon_redemptions table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order_items table exists');
select has_table('public', 'inventory_reservations', 'inventory_reservations table exists');
select has_table('public', 'request_rate_limits', 'request_rate_limits table exists');
select has_function('public', 'available_variant_stock', array['uuid'], 'stock helper exists');
select has_view('public', 'catalog_products', 'catalog_products view still exists');

-- RLS is enabled everywhere ---------------------------------------------------

select is(
  (select bool_and(rowsecurity) from pg_tables
   where schemaname = 'public'
     and tablename in (
       'carts', 'cart_items', 'coupons', 'coupon_redemptions',
       'orders', 'order_items', 'inventory_reservations', 'request_rate_limits'
     )),
  true,
  'RLS enabled on every commerce table'
);

-- Anonymous role has no direct write grant on commerce tables ----------------

set local role anon;

select throws_ok(
  $$insert into carts (token_hash) values (repeat('a', 64))$$,
  '42501',
  NULL,
  'anon cannot insert into carts directly'
);

select throws_ok(
  $$insert into orders (
      order_code, idempotency_key, access_token_hash, customer_name,
      customer_phone, address_snapshot, payment_method, payment_status,
      order_status, subtotal, total
    ) values (
      'TS-X', gen_random_uuid(), repeat('a', 64), 'X', '0900000000',
      '{}'::jsonb, 'cod', 'pending', 'pending', 0, 0
    )$$,
  '42501',
  NULL,
  'anon cannot insert into orders directly'
);

reset role;

-- Constraint enforcement ------------------------------------------------------

select throws_ok(
  $$insert into carts (token_hash) values ('too-short')$$,
  '23514',
  NULL,
  'cart token_hash must be 64 chars'
);

select throws_ok(
  $$insert into coupons (code, discount_type, discount_value)
    values ('lowercase', 'percentage', 10)$$,
  '23514',
  NULL,
  'coupon code must be upper-trimmed'
);

select throws_ok(
  $$insert into coupons (code, discount_type, discount_value)
    values ('BIG', 'percentage', 150)$$,
  '23514',
  NULL,
  'percentage discount cannot exceed 100'
);

-- Order money identity: total = subtotal - discount + shipping, shipping = 0.
select throws_ok(
  $$insert into orders (
      order_code, idempotency_key, access_token_hash, customer_name,
      customer_phone, address_snapshot, payment_method, payment_status,
      order_status, subtotal, discount_total, shipping_total, total
    ) values (
      'TS-BAD-TOTAL', gen_random_uuid(), repeat('b', 64), 'X', '0900000000',
      '{}'::jsonb, 'cod', 'pending', 'pending', 100, 0, 0, 999
    )$$,
  '23514',
  NULL,
  'order total must equal subtotal - discount + shipping'
);

select throws_ok(
  $$insert into orders (
      order_code, idempotency_key, access_token_hash, customer_name,
      customer_phone, address_snapshot, payment_method, payment_status,
      order_status, subtotal, total, shipping_total
    ) values (
      'TS-BAD-SHIP', gen_random_uuid(), repeat('c', 64), 'X', '0900000000',
      '{}'::jsonb, 'cod', 'pending', 'pending', 100, 105, 5
    )$$,
  '23514',
  NULL,
  'order shipping_total must be zero in M3'
);

select throws_ok(
  $$insert into orders (
      order_code, idempotency_key, access_token_hash, customer_name,
      customer_phone, address_snapshot, payment_method, payment_status,
      order_status, subtotal, total
    ) values (
      'TS-BAD-TRANSFER', gen_random_uuid(), repeat('d', 64), 'X', '0900000000',
      '{}'::jsonb, 'bank_transfer', 'pending', 'awaiting_payment', 100, 100
    )$$,
  '23514',
  NULL,
  'bank_transfer order requires transfer_expires_at'
);

-- available_variant_stock: subtracts active, unexpired reservations ----------
-- Seeded variant 40000000-...-0001 (MacBook Air) has inventory quantity 20,
-- reserved_quantity 2 -> base available 18. No commerce reservations yet, so
-- the helper must also return 18.

select is(
  available_variant_stock('40000000-0000-0000-0000-000000000001'),
  18,
  'stock helper matches inventory when no reservations exist'
);

-- Create an order + active reservation for 5 units, then re-check: 18 - 5 = 13.
insert into orders (
  order_code, idempotency_key, access_token_hash, customer_name,
  customer_phone, address_snapshot, payment_method, payment_status,
  order_status, subtotal, total
) values (
  'TS-RESV-TEST', gen_random_uuid(), repeat('e', 64), 'Resv', '0900000000',
  '{}'::jsonb, 'cod', 'pending', 'confirmed', 100, 100
);

insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
values (
  (select id from orders where order_code = 'TS-RESV-TEST'),
  '40000000-0000-0000-0000-000000000001',
  5,
  null
);

select is(
  available_variant_stock('40000000-0000-0000-0000-000000000001'),
  13,
  'stock helper subtracts an active COD reservation'
);

-- A released reservation must not reduce availability.
update inventory_reservations
set released_at = now()
where order_id = (select id from orders where order_code = 'TS-RESV-TEST');

select is(
  available_variant_stock('40000000-0000-0000-0000-000000000001'),
  18,
  'released reservation no longer reduces availability'
);

-- An expired transfer reservation must not reduce availability.
update inventory_reservations
set released_at = null, expires_at = now() - interval '1 hour'
where order_id = (select id from orders where order_code = 'TS-RESV-TEST');

select is(
  available_variant_stock('40000000-0000-0000-0000-000000000001'),
  18,
  'expired reservation no longer reduces availability'
);

-- A reservation on a cancelled order must not reduce availability.
update inventory_reservations
set expires_at = null
where order_id = (select id from orders where order_code = 'TS-RESV-TEST');
update orders set order_status = 'cancelled' where order_code = 'TS-RESV-TEST';

select is(
  available_variant_stock('40000000-0000-0000-0000-000000000001'),
  18,
  'reservation on cancelled order no longer reduces availability'
);

-- catalog_products still enforces published/active visibility for anon --------

set local role anon;

select is(
  (select count(*)::integer from catalog_products),
  4,
  'anon still sees exactly the 4 published catalog products'
);

reset role;

-- Guest-cart RPCs -------------------------------------------------------------

select has_function('public', 'cart_get', array['text'], 'cart_get RPC exists');
select has_function('public', 'cart_add_item', array['text', 'uuid', 'integer'], 'cart_add_item RPC exists');
select has_function('public', 'cart_update_item', array['text', 'uuid', 'integer'], 'cart_update_item RPC exists');
select has_function('public', 'cart_remove_item', array['text', 'uuid'], 'cart_remove_item RPC exists');
select has_function('public', 'cart_apply_coupon', array['text', 'text'], 'cart_apply_coupon RPC exists');

select is(
  cart_add_item(repeat('f', 64), '40000000-0000-0000-0000-000000000001', 2)->>'code',
  'OK',
  'cart_add_item creates an open cart and adds active published variant'
);

select is(
  (cart_get(repeat('f', 64))->>'itemCount')::integer,
  2,
  'cart_get returns quantity count without token hash'
);

select is(
  cart_update_item(
    repeat('f', 64),
    (select id from cart_items where cart_id = (select id from carts where token_hash = repeat('f', 64))),
    3
  )->>'code',
  'OK',
  'cart_update_item changes quantity'
);

select is(
  cart_add_item(repeat('f', 64), '40000000-0000-0000-0000-000000000001', 99)->>'code',
  'OUT_OF_STOCK',
  'cart_add_item checks locked inventory availability'
);

select is(
  cart_apply_coupon(repeat('f', 64), 'MISSING')->>'code',
  'COUPON_INVALID',
  'cart_apply_coupon rejects unknown coupon safely'
);

select is(
  cart_remove_item(
    repeat('f', 64),
    (select id from cart_items where cart_id = (select id from carts where token_hash = repeat('f', 64)))
  )->>'code',
  'OK',
  'cart_remove_item deletes cart item'
);

select is(
  cart_remove_item(repeat('f', 64), '00000000-0000-0000-0000-000000000000')->>'code',
  'OK',
  'cart_remove_item is idempotent when item is already absent'
);

update product_variants
set sale_price = 15
where id = '40000000-0000-0000-0000-000000000001';

insert into coupons (code, discount_type, discount_value)
values ('TENPERCENT', 'percentage', 10);
insert into carts (token_hash, applied_coupon_id)
values (repeat('1', 64), (select id from coupons where code = 'TENPERCENT'));
insert into cart_items (cart_id, variant_id, quantity, price_at_add)
values (
  (select id from carts where token_hash = repeat('1', 64)),
  '40000000-0000-0000-0000-000000000001',
  1,
  15
);

select is(
  (cart_get(repeat('1', 64))->>'discountTotal')::numeric,
  1::numeric,
  'cart_get floors fractional percentage discount to whole VND'
);

set local role anon;

select lives_ok(
  $$select cart_get(repeat('f', 64))$$,
  'anon can call explicitly granted cart_get RPC'
);

reset role;

select * from finish();

rollback;
