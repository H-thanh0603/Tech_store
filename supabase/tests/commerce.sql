-- pgTAP tests for the M3 commerce schema: table/function/view existence,
-- RLS enablement, constraint enforcement, and the reservation-aware stock
-- helper. RPC behavior (cart, order, coupon, tracking) is asserted in later
-- sections as those migrations land. Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(61);

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

select ok(
  (select bool_and(available_stock is not null) from catalog_products),
  'anon can read reservation-aware available_stock on catalog_products'
);

reset role;

select ok(
  (select prosecdef from pg_proc where proname = 'available_variant_stock' limit 1),
  'available_variant_stock is SECURITY DEFINER for catalog reads'
);

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

-- Atomic order placement ------------------------------------------------------

select is(
  (place_order('missing', gen_random_uuid(), repeat('a', 64), '{}'::jsonb, 'cod', null)->>'code'),
  'INTERNAL_ERROR',
  'invalid token hash returns safe INTERNAL_ERROR'
);

select is(
  place_order(
    repeat('2', 64),
    '11111111-1111-4111-8111-111111111111',
    repeat('3', 64),
    '{"customerName":"Nguyen Van A","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'cod', null
  )->>'code',
  'CART_EMPTY',
  'empty cart returns CART_EMPTY'
);

-- Build a deterministic cart with one in-stock MacBook variant.
select cart_add_item(repeat('4', 64), '40000000-0000-0000-0000-000000000001', 2)->>'code';

select is(
  (place_order(
    repeat('4', 64),
    '22222222-2222-4222-8222-222222222222',
    repeat('5', 64),
    '{"customerName":"Nguyen Van B","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'cod', null
  )->>'code'),
  'OK',
  'COD checkout creates order'
);

select is(
  (select count(*)::integer from orders where idempotency_key = '22222222-2222-4222-8222-222222222222'),
  1,
  'COD checkout inserts exactly one order'
);

select is(
  (select count(*)::integer from order_items where order_id = (select id from orders where idempotency_key = '22222222-2222-4222-8222-222222222222')),
  1,
  'order stores item snapshot'
);

select is(
  (select count(*)::integer from inventory_reservations where order_id = (select id from orders where idempotency_key = '22222222-2222-4222-8222-222222222222')),
  1,
  'COD checkout creates non-expiring reservation'
);

select is(
  place_order(
    repeat('4', 64),
    '22222222-2222-4222-8222-222222222222',
    repeat('6', 64), '{}'::jsonb, 'cod', null
  )->>'code',
  'IDEMPOTENT_REPLAY',
  'same idempotency key returns replay marker'
);

select is(
  (place_order(
    repeat('4', 64),
    '22222222-2222-4222-8222-222222222222',
    repeat('6', 64), '{}'::jsonb, 'cod', null
  )->>'orderCode'),
  (select order_code from orders where idempotency_key = '22222222-2222-4222-8222-222222222222'),
  'idempotent replay returns original order code'
);

-- New cart for bank transfer and 24-hour expiry.
select cart_add_item(repeat('7', 64), '40000000-0000-0000-0000-000000000003', 1)->>'code';

select is(
  (place_order(
    repeat('7', 64),
    '33333333-3333-4333-8333-333333333333',
    repeat('8', 64),
    '{"customerName":"Nguyen Van C","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'bank_transfer', null
  )->>'code'),
  'OK',
  'bank transfer checkout creates order'
);

select ok(
  abs(extract(epoch from (
    (select transfer_expires_at from orders where idempotency_key = '33333333-3333-4333-8333-333333333333') -
    (select created_at from orders where idempotency_key = '33333333-3333-4333-8333-333333333333') - interval '24 hours'
  ))) <= 1,
  'bank transfer reservation expires in 24 hours'
);

select is(
  (select order_status from orders where idempotency_key = '33333333-3333-4333-8333-333333333333'),
  'awaiting_payment',
  'bank transfer order awaits payment'
);

-- Seeded coupon behavior ------------------------------------------------------

select is(
  cart_apply_coupon(repeat('4', 64), 'EXPIRED10')->>'code',
  'CART_NOT_FOUND',
  'converted cart stays inaccessible to coupon mutation'
);

select cart_add_item(repeat('9', 64), '40000000-0000-0000-0000-000000000006', 1)->>'code';

select is(
  cart_apply_coupon(repeat('9', 64), 'EXPIRED10')->>'code',
  'COUPON_EXPIRED',
  'expired seeded coupon returns COUPON_EXPIRED'
);

select is(
  cart_apply_coupon(repeat('9', 64), 'UNKNOWN')->>'code',
  'COUPON_INVALID',
  'unknown coupon returns COUPON_INVALID'
);

select is(
  cart_apply_coupon(repeat('9', 64), 'SAVE500K')->>'code',
  'COUPON_MINIMUM',
  'fixed coupon enforces minimum order'
);

select is(
  cart_apply_coupon(repeat('9', 64), 'WELCOME10')->>'code',
  'OK',
  'valid percentage coupon applies to eligible cart'
);

-- Guest tracking and rate limiting -------------------------------------------

select is(
  order_track('BAD-CODE', '0901234567', repeat('a', 64), repeat('b', 64))->>'code',
  'ORDER_NOT_FOUND',
  'wrong order code returns generic ORDER_NOT_FOUND'
);

select is(
  order_track(
    (select order_code from orders where idempotency_key = '22222222-2222-4222-8222-222222222222'),
    '0919999999', repeat('c', 64), repeat('d', 64)
  )->>'code',
  'ORDER_NOT_FOUND',
  'wrong phone returns same generic ORDER_NOT_FOUND'
);

select is(
  order_track(
    (select order_code from orders where idempotency_key = '22222222-2222-4222-8222-222222222222'),
    '0901234567', repeat('e', 64), repeat('f', 64)
  )->>'code',
  'OK',
  'matching code and phone returns redacted order DTO'
);

-- Fill one identity bucket to five attempts, then assert sixth is generic.
select order_track('BAD-1', '0901234567', repeat('1', 64), repeat('2', 64));
select order_track('BAD-2', '0901234567', repeat('1', 64), repeat('2', 64));
select order_track('BAD-3', '0901234567', repeat('1', 64), repeat('2', 64));
select order_track('BAD-4', '0901234567', repeat('1', 64), repeat('2', 64));
select order_track('BAD-5', '0901234567', repeat('1', 64), repeat('2', 64));
select is(
  order_track(
    (select order_code from orders where idempotency_key = '22222222-2222-4222-8222-222222222222'),
    '0901234567', repeat('1', 64), repeat('2', 64)
  )->>'code',
  'ORDER_NOT_FOUND',
  'sixth tracking attempt returns generic ORDER_NOT_FOUND'
);

select * from finish();

rollback;
