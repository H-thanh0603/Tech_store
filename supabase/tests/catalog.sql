-- pgTAP tests for the catalog schema: table existence, unique slugs/SKUs,
-- price/inventory constraints, the publish-requires-variant rule, and
-- anonymous read access limited to active/published rows.
-- Run with: supabase test db
--
-- Note: pgTAP overloads resolve bare string literals to the (table, description)
-- form, so schema/table/column identifiers are cast to `name` to force the
-- schema-qualified overloads. throws_ok uses the (sql, errcode, errmsg, desc)
-- form so the label is a description, not an expected error message.

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

-- Table existence

select has_table('public'::name, 'categories'::name);
select has_table('public'::name, 'brands'::name);
select has_table('public'::name, 'products'::name);
select has_table('public'::name, 'product_variants'::name);
select has_table('public'::name, 'product_images'::name);
select has_table('public'::name, 'inventory'::name);
select has_table('public'::name, 'product_specs'::name);
select has_table('public'::name, 'product_use_cases'::name);

-- Unique slugs / SKUs

select col_is_unique('public'::name, 'categories'::name, 'slug'::name);
select col_is_unique('public'::name, 'brands'::name, 'slug'::name);
select col_is_unique('public'::name, 'products'::name, 'slug'::name);
select col_is_unique('public'::name, 'product_variants'::name, 'sku'::name);

-- Anonymous read access: only active/published rows are visible.
-- Runs against pristine seed data before any mutation tests below.

set local role anon;

select results_eq(
  $$select count(*) from products$$,
  ARRAY[15::bigint],
  'Anonymous role sees only published, non-archived products'
);

select results_eq(
  $$select count(*) from categories$$,
  ARRAY[8::bigint],
  'Anonymous role sees only active categories'
);

select results_eq(
  $$select count(*) from brands$$,
  ARRAY[7::bigint],
  'Anonymous role sees only active brands'
);

select results_eq(
  $$select count(*) from product_variants$$,
  ARRAY[18::bigint],
  'Anonymous role sees only active variants of published products'
);

select results_eq(
  $$select count(*) from inventory$$,
  ARRAY[18::bigint],
  'Anonymous role sees only inventory for visible variants'
);

select results_eq(
  $$select count(*) from product_images$$,
  ARRAY[15::bigint],
  'Anonymous role sees only images of published products'
);

select results_eq(
  $$select count(*) from product_specs$$,
  ARRAY[25::bigint],
  'Anonymous role sees only specs of published products'
);

select results_eq(
  $$select count(*) from product_use_cases$$,
  ARRAY[15::bigint],
  'Anonymous role sees only use cases of published products'
);

select results_eq(
  $$select count(*) from products where slug = 'dell-xps-15-ngung-ban'$$,
  ARRAY[0::bigint],
  'Anonymous role cannot see an archived product'
);

select results_eq(
  $$select count(*) from products where slug = 'tai-nghe-chua-ra-mat'$$,
  ARRAY[0::bigint],
  'Anonymous role cannot see an unpublished product'
);

select results_eq(
  $$select count(*) from products where search_vector @@ plainto_tsquery('simple', 'MacBook')$$,
  ARRAY[1::bigint],
  'Full-text search matches product name for anonymous role'
);

reset role;

-- Price constraints

select throws_ok(
  $$insert into product_variants (product_id, sku, regular_price)
    values ('30000000-0000-0000-0000-000000000001', 'TEST-NEG-PRICE', -1)$$,
  '23514',
  NULL,
  'Negative regular_price is rejected'
);

select throws_ok(
  $$insert into product_variants (product_id, sku, regular_price, sale_price)
    values ('30000000-0000-0000-0000-000000000001', 'TEST-SALE-TOOHIGH', 100, 200)$$,
  '23514',
  NULL,
  'sale_price greater than regular_price is rejected'
);

select lives_ok(
  $$insert into product_variants (product_id, sku, regular_price, sale_price)
    values ('30000000-0000-0000-0000-000000000001', 'TEST-SALE-EQUAL', 100, 100)$$,
  'sale_price equal to regular_price is allowed'
);

-- Inventory constraints (fresh variants so the unique variant_id in inventory does not collide)

insert into product_variants (id, product_id, sku, regular_price)
values
  ('90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'TEST-INV-A', 10),
  ('90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'TEST-INV-B', 10);

select throws_ok(
  $$insert into inventory (variant_id, quantity, reserved_quantity)
    values ('90000000-0000-0000-0000-000000000001', 10, -1)$$,
  '23514',
  NULL,
  'Negative reserved_quantity is rejected'
);

select throws_ok(
  $$insert into inventory (variant_id, quantity, reserved_quantity)
    values ('90000000-0000-0000-0000-000000000002', 1, 5)$$,
  '23514',
  NULL,
  'reserved_quantity greater than quantity is rejected'
);

-- Publish requires an active variant

insert into products (id, category_id, name, slug, is_published)
values ('90000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', 'No Variant Product', 'test-no-variant-product', false);

select throws_ok(
  $$update products set is_published = true where id = '90000000-0000-0000-0000-000000000099'$$,
  'P0001',
  NULL,
  'Publishing a product without an active variant is rejected'
);

select * from finish();

rollback;
