-- pgTAP: cart_capture_email contract + order_returns RLS smoke.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Fixtures: an open cart with an item.
insert into carts (id, token_hash)
values ('d0000000-0000-0000-0000-000000000001', repeat('e', 64))
on conflict (id) do nothing;

insert into products (id, category_id, brand_id, name, slug, description)
values ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', null, 'Capture Test', 'capture-test', 'fixture')
on conflict (id) do nothing;

insert into product_variants (id, product_id, sku, attributes, regular_price, is_active)
values ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'CAP-1', '{}'::jsonb, 1000, true)
on conflict (id) do nothing;

-- 1) Valid email is stored on the open cart.
select is(
  (select (cart_capture_email(repeat('e', 64), '  Guest@Example.COM '))->>'code'),
  'OK',
  'capture returns OK'
);

select is(
  (select email from carts where token_hash = repeat('e', 64)),
  'guest@example.com',
  'email trimmed, lowercased, stored'
);

-- 2) Malformed email is rejected without touching the row.
select is(
  (select (cart_capture_email(repeat('e', 64), 'nope'))->>'code'),
  'VALIDATION_ERROR',
  'malformed email rejected'
);

-- 3) Empty email is a no-op OK (optional field).
select is(
  (select (cart_capture_email(repeat('e', 64), ''))->>'stored'::text),
  'false',
  'empty email stores nothing, still OK'
);

-- 4) order_returns has RLS enabled.
select is(
  (select rowsecurity from pg_tables where tablename = 'order_returns'),
  true,
  'order_returns has row level security enabled'
);

-- 5) No SELECT policy exists on order_returns (service-role only).
select is(
  (select count(*)::text from pg_policies where tablename = 'order_returns'),
  '0',
  'no policies on order_returns — access only via RPCs'
);

select finish();
rollback;
