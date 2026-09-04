-- pgTAP tests for the coupon usage aggregate RPC.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- 1) Returns a JSON object (possibly empty).
select ok(
  (select jsonb_typeof(admin_coupon_usage()) = 'object'),
  'usage map is a JSON object'
);

-- 2) Counts only unreleased redemptions.
select is(
  (select count(*)::int from coupon_redemptions where released_at is null),
  (select coalesce(sum((value)::int), 0)::int
   from jsonb_each_text(admin_coupon_usage())),
  'map total matches unreleased redemption rows'
);

-- 3) Public cannot execute the RPC (service-role only via RLS bypass).
select is(
  (select has_function_privilege('public', 'admin_coupon_usage()', 'execute')),
  false,
  'no public execute grant'
);

select finish();
rollback;
