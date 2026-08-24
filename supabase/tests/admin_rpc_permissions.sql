begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select is(
  (
    select count(*)
    from (
      values
        ('public.admin_dashboard_kpis(timestamptz)'),
        ('public.admin_revenue_by_day(integer, timestamptz)'),
        ('public.admin_orders_by_status()'),
        ('public.admin_revenue_by_category(integer, timestamptz)'),
        ('public.admin_top_products(integer, text, integer, timestamptz)'),
        ('public.admin_stock_alerts(integer)'),
        ('public.admin_list_products(text, text, uuid, uuid, text, text, text, integer, integer)'),
        ('public.admin_adjust_inventory(uuid, integer, text, text, text, integer, integer)'),
        ('public.admin_list_inventory(text, text, uuid, uuid, text, text, integer, integer)'),
        ('public.admin_list_inventory_adjustments(uuid, integer)'),
        ('public.admin_manage_staff_account(uuid, uuid, text, text, boolean)'),
        ('public.admin_revoke_staff_sessions(uuid, uuid)')
    ) as admin_rpcs(signature)
    where to_regprocedure(signature) is null
       or not has_function_privilege('service_role', to_regprocedure(signature), 'execute')
  ),
  0::bigint,
  'service role can execute every admin RPC'
);

select is(
  (
    select count(*)
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind in ('r', 'p')
      and not has_table_privilege('service_role', oid, 'SELECT, INSERT, UPDATE, DELETE')
  ),
  0::bigint,
  'service role can manage every public table'
);

select * from finish();
rollback;
