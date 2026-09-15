-- pgTAP: timeline + retention + matview guards
begin;
select plan(6);

select has_column('public', 'products', 'deleted_at', 'products.deleted_at exists');
select has_column('public', 'product_variants', 'deleted_at', 'variants.deleted_at exists');
select has_column('public', 'admin_audit_logs', 'payload_version', 'audit payload_version exists');
select has_column('public', 'admin_audit_logs', 'payload_schema', 'audit payload_schema exists');
select has_materialized_view('public', 'catalog_products_cached', 'catalog matview exists');
-- function_lang() does not exist in this pgTAP build — assert via pg_catalog.
select is(
  (select l.lanname
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   join pg_language l on l.oid = p.prolang
   where n.nspname = 'public' and p.proname = 'refresh_catalog_cache'),
  'plpgsql',
  'refresh_catalog_cache is plpgsql'
);

select * from finish();
rollback;
