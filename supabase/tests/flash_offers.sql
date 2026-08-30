-- pgTAP tests for flash_offers visibility + admin write boundary.
--
-- RLS contract: anon reads only rows that are active, not expired, and
-- inside their starts_at window (202608300005). Writes are service-role
-- only via the admin server actions — anon gets 42501 on direct writes.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Controlled fixture set (clears demo seed rows inside this transaction).
delete from flash_offers;

insert into flash_offers (id, product_id, title, badge, starts_at, ends_at, is_active) values
  ('61000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'live-now',   'x', now() - interval '1 hour',  now() + interval '1 day',   true),
  ('61000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'not-started','x', now() + interval '1 hour',  now() + interval '2 days',  true),
  ('61000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'expired',    'x', now() - interval '2 days',  now() - interval '1 hour',  true),
  ('61000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'inactive',   'x', now() - interval '1 hour',  now() + interval '1 day',   false);

set local role anon;

select is(
  (select count(*) from flash_offers),
  1::bigint,
  'anon sees only the active offer inside its live window'
);

select is(
  (select title from flash_offers limit 1),
  'live-now',
  'the visible offer is the live one'
);

select throws_ok(
  $$insert into flash_offers (product_id, title, badge, ends_at)
    values ('30000000-0000-0000-0000-000000000001', 'hijack', 'x', now() + interval '1 day')$$,
  '42501',
  NULL,
  'anon cannot insert flash offers directly'
);

reset role;

-- Owner-side sanity: ends_at/starts_at columns behave for admin queries.
select is(
  (select count(*) from flash_offers where starts_at is null),
  0::bigint,
  'fixture rows always carry starts_at (nullable for live-immediately offers)'
);

select ok(
  exists(
    select 1 from pg_proc
    where proname = 'place_order_internal' and proargtypes::text = '25 2950 25 3802 25 25 2950'
  ),
  'sanity: commerce chain intact alongside flash migration'
);

select is(
  (select count(*) from pg_attribute
    where attrelid = 'flash_offers'::regclass and attname = 'starts_at' and not attisdropped),
  1::bigint,
  'flash_offers.starts_at exists for scheduling'
);

select * from finish();

rollback;
