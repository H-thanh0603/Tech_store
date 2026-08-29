-- pgTAP tests for check_rate_limit buckets.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- 1) First attempt passes.
select is(
  (select check_rate_limit('tap_action', 'tap-identity-1', 2, 15)),
  false,
  'first attempt is allowed'
);

-- 2) Second attempt still passes at limit=2.
select is(
  (select check_rate_limit('tap_action', 'tap-identity-1', 2, 15)),
  false,
  'second attempt is allowed at limit 2'
);

-- 3) Third attempt is blocked.
select is(
  (select check_rate_limit('tap_action', 'tap-identity-1', 2, 15)),
  true,
  'third attempt exceeds the limit and is blocked'
);

-- 4) A different identity in the same bucket passes independently.
select is(
  (select check_rate_limit('tap_action', 'tap-identity-2', 2, 15)),
  false,
  'different identity has its own bucket'
);

select finish();
rollback;
