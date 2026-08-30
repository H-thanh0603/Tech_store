-- pgTAP tests for queue_abandoned_cart_emails (abandoned-cart reminders).

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Fixture: open cart with an item and an email, idle past the threshold.
insert into carts (id, token_hash, email, updated_at)
values ('94000000-0000-4000-8000-000000000001', repeat('4', 64),
        'abandoned@example.com', now() - interval '3 hours');

insert into cart_items (cart_id, variant_id, quantity, price_at_add)
values ('94000000-0000-4000-8000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 100);

-- 1) Idle cart with item + email is queued exactly once.
select is(
  queue_abandoned_cart_emails(120, 100)->>'queued',
  '1',
  'idle cart with item and email is queued'
);

-- 2) The outbox row exists with the right type and payload shape.
select is(
  (select count(*)::integer from notification_outbox
   where type = 'abandoned_cart'
     and payload->>'email' = 'abandoned@example.com'
     and payload->>'cartToken' = repeat('4', 64)),
  1,
  'one abandoned_cart outbox row with email and cartToken payload'
);

-- 3) reminded_at was set (dedupe flag).
select is(
  (select count(*)::integer from carts
   where id = '94000000-0000-4000-8000-000000000001'
     and reminded_at is not null),
  1,
  'reminded_at flag is set on the reminded cart'
);

-- 4) Second run queues nothing (dedupe by reminded_at).
select is(
  queue_abandoned_cart_emails(120, 100)->>'queued',
  '0',
  'second run queues nothing (dedupe)'
);

-- 5) Freshly updated cart is not queued.
insert into carts (id, token_hash, email, updated_at)
values ('94000000-0000-4000-8000-000000000002', repeat('5', 64),
        'fresh@example.com', now());

insert into cart_items (cart_id, variant_id, quantity, price_at_add)
values ('94000000-0000-4000-8000-000000000002', '40000000-0000-0000-0000-000000000001', 1, 100);

select is(
  queue_abandoned_cart_emails(120, 100)->>'queued',
  '0',
  'recently active cart is not queued'
);

-- 6) Cart without an item is not queued.
insert into carts (id, token_hash, email, updated_at)
values ('94000000-0000-4000-8000-000000000003', repeat('6', 64),
        'empty@example.com', now() - interval '3 hours');

select is(
  queue_abandoned_cart_emails(120, 100)->>'queued',
  '0',
  'cart without items is not queued'
);

-- 7) Converted carts are never queued.
insert into carts (id, token_hash, email, status, updated_at)
values ('94000000-0000-4000-8000-000000000004', repeat('7', 64),
        'done@example.com', 'converted', now() - interval '3 hours');

insert into cart_items (cart_id, variant_id, quantity, price_at_add)
values ('94000000-0000-4000-8000-000000000004', '40000000-0000-0000-0000-000000000001', 1, 100);

select is(
  queue_abandoned_cart_emails(120, 100)->>'queued',
  '0',
  'converted cart is not queued'
);

select finish();
rollback;
