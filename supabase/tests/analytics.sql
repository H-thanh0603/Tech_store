begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select has_table('public'::name, 'analytics_events'::name);
select has_function('public'::name, 'admin_sales_funnel'::name, array['integer']);
select has_function('public'::name, 'recommend_products'::name, array['uuid', 'integer']);

insert into analytics_events (event_name, session_id, payload, occurred_at)
select event_name, '91000000-0000-0000-0000-000000000099', '{}'::jsonb, now() + offset_value * interval '1 second'
from (values
  ('search_performed', 1),
  ('product_viewed', 2),
  ('add_to_cart', 3),
  ('begin_checkout', 4),
  ('order_completed', 5)
) as fixture(event_name, offset_value);

select is(
  (admin_sales_funnel(7)->4->>'count')::integer,
  1,
  'ordered sessions complete all five funnel stages'
);

rollback;
