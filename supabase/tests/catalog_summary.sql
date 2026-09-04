-- pgTAP tests for product_catalog_summary (DB-022): the catalog view's static
-- facets are trigger-maintained; column surface is unchanged for consumers.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select has_table('public'::name, 'product_catalog_summary'::name);

-- View exposes the same columns consumers rely on. (pgTAP has_column/3
-- resolves bare literals to the description overload, so query the catalog.)
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'catalog_products'
     and column_name in (
       'min_price', 'has_discount', 'available_stock',
       'use_cases', 'image_url', 'image_alt'
     )),
  6::bigint,
  'catalog_products keeps consumer columns'
);

-- anon can read the summary through the invoker view (public catalog data),
-- but has no write privilege.
select is(
  has_table_privilege('anon', 'product_catalog_summary', 'SELECT'),
  true,
  'anon can select product_catalog_summary (feeds catalog_products view)'
);
select is(
  has_table_privilege('anon', 'product_catalog_summary', 'INSERT'),
  false,
  'anon cannot write product_catalog_summary'
);

-- Fixture: product insert alone must create the summary row (inner join).
-- Unpublished (publish requires an active variant first); joinability is
-- what matters, not visibility.
insert into products (id, category_id, name, slug, is_published)
values ('00000000-0000-0000-0000-000000000f01', '10000000-0000-0000-0000-000000000001', 'Summary Product', 'summary-product', false);

select is(
  (select count(*) from product_catalog_summary where product_id = '00000000-0000-0000-0000-000000000f01'),
  1::bigint,
  'product insert creates catalog summary row'
);

rollback;
