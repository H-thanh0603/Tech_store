begin;
select plan(6);

select has_function(
  'public',
  'customer_submit_product_review',
  array['uuid', 'integer', 'text', 'text'],
  'verified review RPC exists'
);
select has_table('public', 'customer_saved_products', 'saved products table exists');
select has_function('public', 'customer_sync_saved_products', array['jsonb'], 'list sync RPC exists');
select is(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'customer_saved_products'),
  true,
  'saved products has RLS'
);

set local role authenticated;
select is(
  customer_submit_product_review(
    '10000000-0000-0000-0000-000000000001', 5, 'Tốt', 'Nội dung'
  )->>'code',
  'UNAUTHORIZED',
  'review RPC rejects a missing auth identity'
);
select is(
  customer_sync_saved_products('{"wishlist":[],"compare":[]}'::jsonb)->>'code',
  'UNAUTHORIZED',
  'list sync RPC rejects a missing auth identity'
);

select * from finish();
rollback;
