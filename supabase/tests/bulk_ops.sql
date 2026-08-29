-- pgTAP tests for admin_bulk_adjust_price and admin_bulk_set_stock.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- Fixtures: one product, three variants (two active, one archived).
insert into products (id, category_id, brand_id, name, slug, description, is_published, is_featured, is_archived)
values (
  'b0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  null,
  'Bulk Test Product',
  'bulk-test-product',
  'fixture',
  false,
  false,
  false
) on conflict (id) do nothing;

insert into product_variants (id, product_id, sku, attributes, regular_price, sale_price, is_active)
values
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'BULK-A', '{}'::jsonb, 1000000, 900000, true),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'BULK-B', '{}'::jsonb, 2000000, null, true),
  ('b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000001', 'BULK-C', '{}'::jsonb, 5000000, null, false)
on conflict (id) do nothing;

insert into inventory (variant_id, quantity, reserved_quantity)
values
  ('b0000000-0000-0000-0000-000000000011', 10, 2),
  ('b0000000-0000-0000-0000-000000000012', 0, 0)
on conflict (variant_id) do nothing;

-- 1) percent_up scales regular and sale prices of active variants.
select is(
  (
    select (admin_bulk_adjust_price(
      array['b0000000-0000-0000-0000-000000000001']::uuid[],
      'percent_up', 10, 'tap'
    ))->>'code'
  ),
  'OK',
  'percent_up returns OK'
);

-- 2) Regular price scales by 10% (compare via ::text to avoid numeric scale noise).
select is(
  (select regular_price::text from product_variants where sku = 'BULK-A'),
  '1100000.00',
  'percent_up rounds regular price up by 10%'
);

-- 3) Existing sale price scales proportionally.
select is(
  (select sale_price::text from product_variants where sku = 'BULK-A'),
  '990000.00',
  'percent_up scales the existing sale price proportionally'
);

-- 4) Archived variants are untouched.
select is(
  (select regular_price::text from product_variants where sku = 'BULK-C'),
  '5000000.00',
  'percent_up leaves archived variants untouched'
);

-- 5) set_sale_off clears discounts on active variants.
select is(
  (
    select (admin_bulk_adjust_price(
      array['b0000000-0000-0000-0000-000000000001']::uuid[],
      'set_sale_off', 0, 'tap'
    ))->>'code'
  ),
  'OK',
  'set_sale_off returns OK'
);

select is(
  (select sale_price is null from product_variants where sku = 'BULK-A'),
  true,
  'set_sale_off clears the discount'
);

-- 6) bulk set_stock applies the requested quantity and keeps the reservation floor.
select is(
  (
    select (admin_bulk_set_stock(
      array['b0000000-0000-0000-0000-000000000001']::uuid[],
      1, 'tap'
    ))->>'code'
  ),
  'OK',
  'set_stock returns OK'
);

select is(
  (select quantity from inventory where variant_id = 'b0000000-0000-0000-0000-000000000011'),
  2,
  'set_stock floors the new quantity at reserved_quantity'
);

select finish();
rollback;
