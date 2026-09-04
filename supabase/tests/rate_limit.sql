-- pgTAP tests for check_rate_limit buckets.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

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

-- 5) DB-051: anon cannot execute the limiter directly (abuse primitive).
select is(
  has_function_privilege('anon', 'check_rate_limit(text, text, integer, integer)', 'execute'),
  false,
  'anon has no execute privilege on check_rate_limit'
);

-- 6) Assistant chat buckets are allowlisted (first call must not block).
select is(
  (select check_rate_limit('assistant_chat', 'tap-assistant-1', 20, 15)),
  false,
  'assistant_chat bucket is allowlisted'
);

select finish();
rollback;
