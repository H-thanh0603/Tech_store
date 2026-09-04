-- pgTAP tests for DB-050: raw inventory rows are not browser-readable;
-- per-variant stock goes through the product_variant_availability RPC.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select has_function('public'::name, 'product_variant_availability'::name, array['uuid']);

-- anon lost raw-table reads (revoked at migration time).
select is(
  has_table_privilege('anon', 'inventory', 'SELECT'),
  false,
  'anon has no select privilege on inventory'
);

-- The RPC exposes reservation-aware stock for a seeded published product.
select is(
  (select count(*) from product_variant_availability('30000000-0000-0000-0000-000000000001')),
  (select count(*) from product_variants where product_id = '30000000-0000-0000-0000-000000000001' and is_active = true),
  'availability RPC covers every active variant'
);

select ok(
  (select bool_and(available_stock >= 0) from product_variant_availability('30000000-0000-0000-0000-000000000001')),
  'availability stock never goes negative'
);

rollback;
