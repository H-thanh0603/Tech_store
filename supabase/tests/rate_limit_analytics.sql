-- analytics_events bucket must be allowlisted: unknown actions return
-- limited=true, which would 429 every page view after the throttle shipped.
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select is(
  (select check_rate_limit('analytics_events', 'analytics-allowlist-probe', 60, 1)),
  false,
  'analytics_events bucket is allowlisted (first attempt allowed)'
);

select is(
  (select check_rate_limit('tap_action', 'tap-allowlist-probe', 2, 15)),
  false,
  'existing tap_action bucket still allowlisted'
);

select * from finish();
rollback;
