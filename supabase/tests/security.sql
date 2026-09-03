-- Regression checks for public checkout identity and review privacy.
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_function(
  'public',
  'place_order',
  array['text', 'uuid', 'text', 'jsonb', 'text', 'text', 'text'],
  'secure seven-argument place_order wrapper exists (IP-bound)'
);

select has_function(
  'public',
  'place_order_internal',
  array['text', 'uuid', 'text', 'jsonb', 'text', 'text', 'uuid'],
  'internal order implementation exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.place_order(text, uuid, text, jsonb, text, text, text)',
    'execute'
  ),
  true,
  'anon can use the safe checkout wrapper'
);

select is(
  has_function_privilege(
    'anon',
    'public.place_order_internal(text, uuid, text, jsonb, text, text, uuid)',
    'execute'
  ),
  false,
  'anon cannot execute the internal identity-aware function'
);

select has_view('public', 'public_product_reviews', 'safe public review view exists');

select is(
  has_column_privilege('anon', 'public.product_reviews', 'user_id', 'SELECT'),
  false,
  'anon cannot read product review user_id'
);

select is(
  has_column_privilege('authenticated', 'public.product_reviews', 'user_id', 'SELECT'),
  false,
  'authenticated cannot read product review user_id'
);

select is(
  has_column_privilege('anon', 'public.product_reviews', 'body', 'SELECT'),
  true,
  'anon can read safe review columns'
);

select has_table('public', 'admin_users', 'admin identity table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.admin_users'::regclass),
  'admin identity table has RLS enabled'
);

select is(
  has_table_privilege('anon', 'public.admin_users', 'SELECT'),
  false,
  'anon cannot read admin identities'
);

select * from finish();
rollback;
