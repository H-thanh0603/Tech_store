-- pgTAP: timeline + retention + matview guards
begin;
select plan(6);

select has_column('public', 'products', 'deleted_at', 'products.deleted_at exists');
select has_column('public', 'product_variants', 'deleted_at', 'variants.deleted_at exists');
select has_column('public', 'admin_audit_logs', 'payload_version', 'audit payload_version exists');
select has_column('public', 'admin_audit_logs', 'payload_schema', 'audit payload_schema exists');
select has_materialized_view('public', 'catalog_products_cached', 'catalog matview exists');
select function_lang('public', 'refresh_catalog_cache', 'plpgsql', 'refresh_catalog_cache is plpgsql');

select * from finish();
rollback;
