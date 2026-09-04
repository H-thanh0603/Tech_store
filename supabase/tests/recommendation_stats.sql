-- pgTAP tests for product_recommendation_stats (DB-023): counters are
-- trigger-maintained on order_items insert, order cancel, and review writes;
-- recommend_products reads pre-computed counters.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public'::name, 'product_recommendation_stats'::name);
select has_function('public'::name, 'recommend_products'::name, array['uuid', 'integer']);
select has_function('public'::name, 'product_recommendation_stats_refresh'::name, array['uuid']);

-- anon has no SELECT grant on the raw stats table (revoked at migration time).
select is(
  has_table_privilege('anon', 'product_recommendation_stats', 'SELECT'),
  false,
  'anon has no select privilege on product_recommendation_stats'
);

-- Fixture: product, variant, order with one item. Product stays unpublished
-- (publish requires an active variant first); stats triggers do not care.
insert into products (id, category_id, name, slug, is_published)
values ('00000000-0000-0000-0000-000000000e01', '10000000-0000-0000-0000-000000000001', 'Stats Product', 'stats-product', false);

insert into product_variants (id, product_id, sku, regular_price, is_active)
values ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e01', 'SKU-STATS', 1000, true);

insert into orders (
  id, order_code, idempotency_key, access_token_hash, customer_name,
  customer_phone, address_snapshot, payment_method, payment_status,
  order_status, subtotal, discount_total, shipping_total, total
) values (
  '00000000-0000-0000-0000-000000000e03', 'ORD-STATS-1', '00000000-0000-0000-0000-0000000000e4',
  repeat('e', 64), 'Test', '0900000001', '{}'::jsonb, 'cod', 'pending',
  'pending', 2000, 0, 0, 2000
);

insert into order_items (order_id, variant_id, sku, product_name, attributes, unit_price, quantity, line_total)
values (
  '00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-000000000e02',
  'SKU-STATS', 'Stats Product', '{}'::jsonb, 1000, 2, 2000
);

select is(
  (select purchase_count from product_recommendation_stats
   where product_id = '00000000-0000-0000-0000-000000000e01'),
  2::numeric,
  'order_items insert maintains purchase_count'
);

-- Cancel the order -> trigger on orders.order_status recomputes.
update orders set order_status = 'cancelled' where id = '00000000-0000-0000-0000-000000000e03';

select is(
  (select purchase_count from product_recommendation_stats
   where product_id = '00000000-0000-0000-0000-000000000e01'),
  0::numeric,
  'order cancel recomputes purchase_count'
);

-- Review write maintains rating/count.
insert into product_reviews (product_id, author_name, rating, title, body)
values ('00000000-0000-0000-0000-000000000e01', 'Reviewer', 4, null, 'Tốt');

select is(
  (select review_count from product_recommendation_stats
   where product_id = '00000000-0000-0000-0000-000000000e01'),
  1::numeric,
  'review insert maintains review_count'
);

rollback;
