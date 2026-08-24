-- Concurrent notification workers must claim disjoint rows before sending.

begin;
select plan(4);

insert into notification_outbox (id, type, payload, queued_at) values
  ('d1000000-0000-0000-0000-000000000001', 'order_confirmation', '{"email":"one@example.com"}', now() - interval '3 minutes'),
  ('d1000000-0000-0000-0000-000000000002', 'order_confirmation', '{"email":"two@example.com"}', now() - interval '2 minutes'),
  ('d1000000-0000-0000-0000-000000000003', 'order_confirmation', '{"email":"three@example.com"}', now() - interval '1 minute');

set local role service_role;

create temp table claimed_one as
select * from claim_notification_outbox(2, 'd1000000-0000-4000-8000-000000000001');

select is((select count(*)::integer from claimed_one), 2, 'first worker claims its batch');
select is(
  (select count(*)::integer from notification_outbox where status = 'processing'),
  2,
  'claimed rows move to processing'
);

create temp table claimed_two as
select * from claim_notification_outbox(2, 'd1000000-0000-4000-8000-000000000002');

select is((select count(*)::integer from claimed_two), 1, 'second worker only claims remaining rows');
select is(
  (select count(*)::integer from claimed_one a join claimed_two b using (id)),
  0,
  'concurrent claim batches never overlap'
);

select * from finish();
rollback;
