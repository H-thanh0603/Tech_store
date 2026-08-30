-- Regression tests for 202608300004_fix_order_access_and_shipping.sql.
--
-- 202608270002_shipping_rates.sql silently rewrote order_get_by_access from
-- SECURITY DEFINER to SECURITY INVOKER (anon has no grants on orders, so
-- every guest order-read failed with 42501) and left calculate_shipping
-- invoker-facing a table anon cannot read. These tests run the RPCs under
-- `set local role anon` — the blind spot that let the regression pass CI.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Fixture order (inserted as table owner; anon can never insert directly).
insert into orders (
  order_code, idempotency_key, access_token_hash, customer_name,
  customer_phone, address_snapshot, payment_method, payment_status,
  order_status, subtotal, discount_total, shipping_total, total
) values (
  'TS-ACCESS-001', gen_random_uuid(), repeat('b', 64), 'Access Test',
  '0901234567', '{"province":"TP.HCM"}'::jsonb, 'cod', 'pending',
  'pending', 100000, 0, 0, 100000
);

insert into order_items (order_id, product_name, sku, attributes, unit_price, quantity, line_total)
select id, 'Test product', 'TS-ACCESS-SKU', '{}'::jsonb, 100000, 1, 100000
from orders where order_code = 'TS-ACCESS-001';

-- Security attributes ---------------------------------------------------------

select is(
  (select prosecdef from pg_proc where proname = 'order_get_by_access' limit 1),
  true,
  'order_get_by_access is SECURITY DEFINER (anon cannot read orders directly)'
);

select is(
  (select prosecdef from pg_proc where proname = 'calculate_shipping' limit 1),
  true,
  'calculate_shipping is SECURITY DEFINER (anon cannot read shipping_rates directly)'
);

select is(
  (select count(*) from pg_proc
    where proname = 'place_order_internal'
      and proargtypes::text = '25 25 3802 25 25'),
  0::bigint,
  'broken 5-arg place_order_internal overload is dropped'
);

-- Guest order read under anon role --------------------------------------------

set local role anon;

select is(
  (order_get_by_access('TS-ACCESS-001', repeat('b', 64))->>'code'),
  'OK',
  'anon can read own order via order_get_by_access (was 42501 under invoker regression)'
);

select is(
  (order_get_by_access('TS-ACCESS-001', repeat('b', 64))->>'customerPhone'),
  '0901234567',
  'order_get_by_access returns normalized customerPhone'
);

select is(
  (order_get_by_access('TS-ACCESS-001', repeat('b', 64))->>'fulfillmentMethod'),
  'delivery',
  'order_get_by_access returns fulfillmentMethod (pickup regression restored)'
);

select is(
  (order_get_by_access('TS-ACCESS-001', repeat('c', 64))->>'code'),
  'ORDER_NOT_FOUND',
  'wrong access token returns ORDER_NOT_FOUND, not an error'
);

select is(
  (order_get_by_access('TS-ACCESS-001', 'not-a-hash')->>'code'),
  'ORDER_NOT_FOUND',
  'malformed access token hash returns ORDER_NOT_FOUND'
);

reset role;

-- Shipping calculation under anon role ----------------------------------------

set local role anon;

select is(
  ((calculate_shipping(100000, 1)->>'shippingTotal')::numeric),
  (select base_rate from shipping_rates where is_active order by created_at asc limit 1),
  'anon can calculate shipping (shipping_rates read grant restored)'
);

select ok(
  (select count(*) > 0 from shipping_rates),
  'anon can read active shipping_rates rows (missing grant restored)'
);

reset role;

select * from finish();

rollback;
