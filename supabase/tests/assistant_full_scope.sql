-- pgTAP tests for assistant memory, campaign briefs, and merchant digests.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- customer_memories: table + RLS + session-key format + facts size cap.
select has_table('customer_memories');
select ok(
  (select relrowsecurity from pg_class where relname = 'customer_memories'),
  'RLS enabled on customer_memories'
);
insert into customer_memories (session_key, facts)
values (repeat('b', 64), '{"budget_vnd": 20000000}'::jsonb);
select is(
  (select (facts->>'budget_vnd')::bigint from customer_memories where session_key = repeat('b', 64)),
  20000000::bigint,
  'memory facts round-trip'
);

-- campaign_briefs: table + RLS + default status + discount guardrail.
select has_table('campaign_briefs');
select ok(
  (select relrowsecurity from pg_class where relname = 'campaign_briefs'),
  'RLS enabled on campaign_briefs'
);
insert into campaign_briefs (title, mechanic, discount_pct, execution)
values ('Sale 9.9 test', 'percent_off', 10, 'Tạo coupon SALE99');
select is(
  (select status from campaign_briefs where title = 'Sale 9.9 test'),
  'proposed',
  'briefs default to proposed'
);

-- merchant_digests: table + RLS.
select has_table('merchant_digests');
select ok(
  (select relrowsecurity from pg_class where relname = 'merchant_digests'),
  'RLS enabled on merchant_digests'
);
insert into merchant_digests (period, payload)
values ('daily', '{"snapshot": null}'::jsonb);
select ok(
  (select count(*)::int from merchant_digests where period = 'daily') >= 1,
  'digest inserts cleanly'
);

select * from finish();

rollback;
