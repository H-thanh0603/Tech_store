-- pgTAP tests for the no-hard-delete-of-purchased-product migration.
-- Blueprint §10.2: a product/variant that appears in an order must not be
-- hard-deleted — archive instead. Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Fixture: product + variant + a single order_item snapshot.
insert into products (id, category_id, name, slug, is_published)
values ('00000000-0000-0000-0000-000000000d01', '10000000-0000-0000-0000-000000000001', 'Sold Product', 'sold-product', false);

insert into product_variants (id, product_id, sku, regular_price, is_active)
values ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000d01', 'SKU-SOLD', 1000, true);

insert into orders (
  id, order_code, idempotency_key, access_token_hash, customer_name,
  customer_phone, address_snapshot, payment_method, payment_status,
  order_status, subtotal, total
) values (
  '00000000-0000-0000-0000-000000000d03', 'TS-TEST', gen_random_uuid(), repeat('a', 64),
  'X', '0900000000', '{}'::jsonb, 'cod', 'pending', 'pending', 1000, 1000
);

insert into order_items (order_id, variant_id, product_name, sku, unit_price, quantity, line_total)
values ('00000000-0000-0000-0000-000000000d03', '00000000-0000-0000-0000-000000000d02', 'Sold Product', 'SKU-SOLD', 1000, 1, 1000);

-- 1. Deleting a purchased variant is blocked.
select throws_ok(
  $$delete from product_variants where id = '00000000-0000-0000-0000-000000000d02'$$,
  '23514', NULL,
  'cannot hard-delete a variant that appears in order_items'
);

-- 2. Deleting a product with a purchased variant is blocked.
select throws_ok(
  $$delete from products where id = '00000000-0000-0000-0000-000000000d01'$$,
  '23503', NULL,
  'cannot hard-delete a product whose variant appears in order_items'
);

-- 3. An unpurchased variant can still be deleted.
insert into product_variants (id, product_id, sku, regular_price, is_active)
values ('00000000-0000-0000-0000-000000000d04', '00000000-0000-0000-0000-000000000d01', 'SKU-FREE', 2000, true);

select lives_ok(
  $$delete from product_variants where id = '00000000-0000-0000-0000-000000000d04'$$,
  'unpurchased variant can be deleted'
);

-- 4. An unpurchased product can be deleted.
insert into products (id, category_id, name, slug, is_published)
values ('00000000-0000-0000-0000-000000000d05', '10000000-0000-0000-0000-000000000001', 'Free Product', 'free-product', false);

insert into product_variants (id, product_id, sku, regular_price, is_active)
values ('00000000-0000-0000-0000-000000000d06', '00000000-0000-0000-0000-000000000d05', 'SKU-FREE-2', 3000, true);

select lives_ok(
  $$delete from products where id = '00000000-0000-0000-0000-000000000d05'$$,
  'unpurchased product can be deleted'
);

-- 5. Archiving is still allowed (no hard delete).
insert into products (id, category_id, name, slug, is_published)
values ('00000000-0000-0000-0000-000000000d07', '10000000-0000-0000-0000-000000000001', 'Archive Me', 'archive-me', true);

select lives_ok(
  $$update products set is_archived = true where id = '00000000-0000-0000-0000-000000000d07'$$,
  'archiving a product is allowed'
);

rollback;