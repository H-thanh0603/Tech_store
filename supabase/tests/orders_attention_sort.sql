-- pgTAP: admin_list_orders attention sort surfaces actionable orders first.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);
set local role service_role;

insert into orders (
  order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values
  ('TS-ATT-1', gen_random_uuid(), repeat('a', 64),
   'Attention Tester', '0901234567', '{}'::jsonb,
   'cod', 'pending', 'completed', 100, 100),
  ('TS-ATT-2', gen_random_uuid(), repeat('b', 64),
   'Attention Tester', '0901234567', '{}'::jsonb,
   'cod', 'pending', 'awaiting_payment', 100, 100),
  ('TS-ATT-3', gen_random_uuid(), repeat('c', 64),
   'Attention Tester', '0901234567', '{}'::jsonb,
   'cod', 'pending', 'pending', 100, 100);

select is(
  (admin_list_orders('ATT', 'all', 'all', 'all', null, null, 'attention', 'desc', 1, 20)->'rows'->0->>'orderStatus'),
  'pending',
  'attention sort puts pending first'
);

select is(
  (admin_list_orders('ATT', 'all', 'all', 'all', null, null, 'attention', 'desc', 1, 20)->'rows'->1->>'orderStatus'),
  'awaiting_payment',
  'attention sort puts awaiting_payment second'
);

select is(
  (admin_list_orders('ATT', 'all', 'all', 'all', null, null, 'attention', 'desc', 1, 20)->'rows'->2->>'orderStatus'),
  'completed',
  'attention sort buries completed last'
);

select is(
  (admin_list_orders('ATT', 'all', 'all', 'all', null, null, 'bogus_sort', 'desc', 1, 20)->'rows'->0->>'orderCode'),
  (select order_code from orders where order_code like 'TS-ATT-%' order by created_at desc limit 1),
  'unknown sort falls back to created_at desc'
);

select * from finish();
rollback;
