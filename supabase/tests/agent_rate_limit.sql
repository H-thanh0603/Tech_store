-- pgTAP tests for the agent-layer rate limit buckets (docs/AGENT_LAYER.md).

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- 1) agents_catalog bucket is allowlisted: first call must not block.
select is(
  (select check_rate_limit('agents_catalog', 'tap-agent-catalog-1', 60, 15)),
  false,
  'agents_catalog bucket is allowlisted'
);

-- 2) agents_orders bucket is allowlisted: first call must not block.
select is(
  (select check_rate_limit('agents_orders', 'tap-agent-orders-1', 20, 15)),
  false,
  'agents_orders bucket is allowlisted'
);

-- 3) Unknown agent-ish actions are still blocked (allowlist, not prefix match).
select is(
  (select check_rate_limit('agents_admin', 'tap-agent-admin-1', 5, 15)),
  true,
  'unknown agents_* action is blocked on first call'
);

select finish();
rollback;
