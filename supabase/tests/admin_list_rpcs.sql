begin;

create extension if not exists pgtap with schema extensions;

select plan(2);
set local role service_role;

select lives_ok(
  $$select public.admin_list_products()$$,
  'service role can list admin products'
);

select lives_ok(
  $$select public.admin_list_inventory()$$,
  'service role can list admin inventory'
);

select * from finish();
rollback;
