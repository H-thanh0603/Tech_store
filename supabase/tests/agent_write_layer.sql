-- pgTAP tests for the agent write layer (tasks 4-5): token/intent tables are
-- RLS-on with zero public policies (service_role only), and the new
-- agents_intents bucket is allowlisted in check_rate_limit.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- 1) agents_intents bucket is allowlisted: first call must not block.
select is(
  (select check_rate_limit('agents_intents', 'tap-agent-intents-1', 30, 15)),
  false,
  'agents_intents bucket is allowlisted'
);

-- 2) RLS is enabled on both tables.
select is(
  (select relrowsecurity from pg_class where relname = 'agent_tokens'),
  true,
  'agent_tokens has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where relname = 'agent_order_intents'),
  true,
  'agent_order_intents has RLS enabled'
);

-- 3) No public policies: anon/authenticated cannot read either table.
select is(
  (select count(*)::int from pg_policies where tablename in ('agent_tokens', 'agent_order_intents')),
  0,
  'no policies expose agent tables to anon/authenticated'
);

-- 4) Scope check constraint rejects unknown scopes.
select throws_ok(
  $$ insert into agent_tokens (name, token_hash, scopes)
     values ('tap', repeat('a', 64), '{admin}') $$,
  '23514',
  'new row for relation "agent_tokens" violates check constraint "agent_tokens_scopes_known"',
  'unknown agent scope is rejected by check constraint'
);

select finish();
rollback;
