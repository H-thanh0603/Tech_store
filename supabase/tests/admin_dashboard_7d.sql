-- pgTAP tests for the 7-day dashboard aggregate RPC.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- 1) Returns all five keys with numeric values.
select ok(
  (select (admin_dashboard_stats_7d() ->> 'revenue7d') is not null
      and (admin_dashboard_stats_7d() ->> 'newOrders7d') is not null
      and (admin_dashboard_stats_7d() ->> 'pendingOrders') is not null
      and (admin_dashboard_stats_7d() ->> 'lowStockCount') is not null
      and (admin_dashboard_stats_7d() ->> 'draftProducts') is not null),
  'all five aggregate keys present'
);

-- 2) Counts are non-negative integers.
select ok(
  (select (admin_dashboard_stats_7d() ->> 'newOrders7d')::int >= 0
      and (admin_dashboard_stats_7d() ->> 'pendingOrders')::int >= 0
      and (admin_dashboard_stats_7d() ->> 'lowStockCount')::int >= 0
      and (admin_dashboard_stats_7d() ->> 'draftProducts')::int >= 0),
  'counts are non-negative'
);

-- 3) Revenue is non-negative.
select ok(
  (select (admin_dashboard_stats_7d() ->> 'revenue7d')::numeric >= 0),
  'revenue is non-negative'
);

-- 4) Public cannot execute the RPC (service-role only via RLS bypass).
select is(
  (select has_function_privilege('public', 'admin_dashboard_stats_7d(timestamptz)', 'execute')),
  false,
  'no public execute grant'
);

select finish();
rollback;
