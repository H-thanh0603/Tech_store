-- 7-day dashboard aggregates in SQL (replaces client-side full-table scans).
--
-- getDashboardStats used to pull the whole orders-7d window and the entire
-- inventory table into Node and aggregate in JS. Past ~1000 inventory rows
-- PostgREST silently truncates, so lowStockCount went wrong without erroring.
-- This RPC computes everything in one round trip with no row ceiling.

create or replace function admin_dashboard_stats_7d(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_since timestamptz := p_now - interval '7 days';
  v_revenue numeric := 0;
  v_new_orders int := 0;
  v_pending int := 0;
  v_low_stock int := 0;
  v_drafts int := 0;
begin
  select coalesce(sum(total), 0), count(*)::int
  into v_revenue, v_new_orders
  from orders
  where created_at >= v_since
    and order_status not in ('cancelled', 'expired');

  select count(*)::int
  into v_pending
  from orders
  where order_status in ('pending', 'awaiting_payment', 'confirmed', 'packing');

  select count(*)::int
  into v_low_stock
  from inventory
  where (quantity - reserved_quantity) <= low_stock_threshold;

  select count(*)::int
  into v_drafts
  from products
  where is_published = false
    and is_archived = false;

  return jsonb_build_object(
    'revenue7d', v_revenue,
    'newOrders7d', v_new_orders,
    'pendingOrders', v_pending,
    'lowStockCount', v_low_stock,
    'draftProducts', v_drafts
  );
end;
$$;

revoke all on function admin_dashboard_stats_7d(timestamptz) from public;
