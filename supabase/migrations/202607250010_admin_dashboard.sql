-- Admin dashboard aggregates (service-role only via Next.js).
-- Revenue-eligible orders: status NOT IN ('cancelled', 'expired').
-- Business day boundaries use Asia/Ho_Chi_Minh.

create or replace function admin_vn_day_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select (date_trunc('day', p_ts at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
$$;

create or replace function admin_vn_month_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select (date_trunc('month', p_ts at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
$$;

create or replace function admin_dashboard_kpis(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today_start timestamptz := admin_vn_day_start(p_now);
  v_tomorrow timestamptz := v_today_start + interval '1 day';
  v_yesterday_start timestamptz := v_today_start - interval '1 day';
  v_month_start timestamptz := admin_vn_month_start(p_now);
  v_prev_month_start timestamptz := admin_vn_month_start(v_month_start - interval '1 day');
  v_revenue_today numeric := 0;
  v_revenue_yesterday numeric := 0;
  v_revenue_month numeric := 0;
  v_revenue_prev_month numeric := 0;
  v_orders_today int := 0;
  v_orders_yesterday int := 0;
  v_pending int := 0;
  v_aov_month numeric := 0;
  v_month_order_count int := 0;
  v_low_stock int := 0;
  v_out_of_stock int := 0;
begin
  select coalesce(sum(total), 0), count(*)::int
  into v_revenue_today, v_orders_today
  from orders
  where created_at >= v_today_start
    and created_at < v_tomorrow
    and order_status not in ('cancelled', 'expired');

  select coalesce(sum(total), 0), count(*)::int
  into v_revenue_yesterday, v_orders_yesterday
  from orders
  where created_at >= v_yesterday_start
    and created_at < v_today_start
    and order_status not in ('cancelled', 'expired');

  select coalesce(sum(total), 0), count(*)::int
  into v_revenue_month, v_month_order_count
  from orders
  where created_at >= v_month_start
    and created_at < v_tomorrow
    and order_status not in ('cancelled', 'expired');

  select coalesce(sum(total), 0)
  into v_revenue_prev_month
  from orders
  where created_at >= v_prev_month_start
    and created_at < v_month_start
    and order_status not in ('cancelled', 'expired');

  select count(*)::int into v_pending
  from orders
  where order_status in ('pending', 'awaiting_payment', 'confirmed', 'packing');

  if v_month_order_count > 0 then
    v_aov_month := v_revenue_month / v_month_order_count;
  else
    v_aov_month := 0;
  end if;

  select count(*)::int into v_out_of_stock
  from inventory i
  where (i.quantity - i.reserved_quantity) <= 0;

  select count(*)::int into v_low_stock
  from inventory i
  where (i.quantity - i.reserved_quantity) > 0
    and (i.quantity - i.reserved_quantity) <= i.low_stock_threshold;

  return jsonb_build_object(
    'revenueToday', v_revenue_today,
    'revenueYesterday', v_revenue_yesterday,
    'revenueMonth', v_revenue_month,
    'revenuePrevMonth', v_revenue_prev_month,
    'ordersToday', v_orders_today,
    'ordersYesterday', v_orders_yesterday,
    'pendingOrders', v_pending,
    'aovMonth', v_aov_month,
    'monthOrderCount', v_month_order_count,
    'lowStockCount', v_low_stock,
    'outOfStockCount', v_out_of_stock,
    'timezone', 'Asia/Ho_Chi_Minh'
  );
end;
$$;

create or replace function admin_revenue_by_day(p_days int default 30, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 90));
  v_end timestamptz := admin_vn_day_start(p_now) + interval '1 day';
  v_start timestamptz := admin_vn_day_start(p_now) - ((v_days - 1) * interval '1 day');
  v_result jsonb;
begin
  with days as (
    select generate_series(v_start, v_end - interval '1 day', interval '1 day') as day_start
  ),
  agg as (
    select
      admin_vn_day_start(o.created_at) as day_start,
      coalesce(sum(o.total), 0) as revenue,
      count(*)::int as order_count
    from orders o
    where o.created_at >= v_start
      and o.created_at < v_end
      and o.order_status not in ('cancelled', 'expired')
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(d.day_start at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
        'revenue', coalesce(a.revenue, 0),
        'orderCount', coalesce(a.order_count, 0)
      )
      order by d.day_start
    ),
    '[]'::jsonb
  )
  into v_result
  from days d
  left join agg a on a.day_start = d.day_start;

  return v_result;
end;
$$;

create or replace function admin_orders_by_status()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('status', order_status, 'count', cnt)
      order by cnt desc
    ),
    '[]'::jsonb
  )
  from (
    select order_status, count(*)::int as cnt
    from orders
    group by order_status
  ) s;
$$;

create or replace function admin_revenue_by_category(p_days int default 30, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 90));
  v_end timestamptz := admin_vn_day_start(p_now) + interval '1 day';
  v_start timestamptz := admin_vn_day_start(p_now) - ((v_days - 1) * interval '1 day');
  v_result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'categoryId', category_id,
        'categoryName', category_name,
        'revenue', revenue,
        'quantity', quantity
      )
      order by revenue desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      coalesce(c.id::text, 'unknown') as category_id,
      coalesce(c.name, 'Không xác định') as category_name,
      coalesce(sum(oi.line_total), 0) as revenue,
      coalesce(sum(oi.quantity), 0)::int as quantity
    from order_items oi
    join orders o on o.id = oi.order_id
    left join product_variants pv on pv.id = oi.variant_id
    left join products p on p.id = pv.product_id
    left join categories c on c.id = p.category_id
    where o.created_at >= v_start
      and o.created_at < v_end
      and o.order_status not in ('cancelled', 'expired')
    group by c.id, c.name
  ) x;

  return v_result;
end;
$$;

create or replace function admin_top_products(
  p_days int default 30,
  p_metric text default 'revenue',
  p_limit int default 8,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 90));
  v_limit int := greatest(1, least(coalesce(p_limit, 8), 20));
  v_metric text := case when p_metric = 'quantity' then 'quantity' else 'revenue' end;
  v_end timestamptz := admin_vn_day_start(p_now) + interval '1 day';
  v_start timestamptz := admin_vn_day_start(p_now) - ((v_days - 1) * interval '1 day');
  v_result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productName', product_name,
        'sku', sku,
        'quantity', quantity,
        'revenue', revenue
      )
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      oi.product_name,
      oi.sku,
      sum(oi.quantity)::int as quantity,
      sum(oi.line_total) as revenue
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.created_at >= v_start
      and o.created_at < v_end
      and o.order_status not in ('cancelled', 'expired')
    group by oi.product_name, oi.sku
    order by
      case when v_metric = 'quantity' then sum(oi.quantity) else sum(oi.line_total) end desc
    limit v_limit
  ) t;

  return v_result;
end;
$$;

create or replace function admin_stock_alerts(p_limit int default 10)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 10), 50));
  v_low jsonb;
  v_out jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', product_id,
        'productName', product_name,
        'sku', sku,
        'available', available,
        'threshold', threshold,
        'status', status
      )
    ),
    '[]'::jsonb
  )
  into v_low
  from (
    select
      p.id::text as product_id,
      p.name as product_name,
      pv.sku,
      (i.quantity - i.reserved_quantity) as available,
      i.low_stock_threshold as threshold,
      'low_stock' as status
    from inventory i
    join product_variants pv on pv.id = i.variant_id
    join products p on p.id = pv.product_id
    where (i.quantity - i.reserved_quantity) > 0
      and (i.quantity - i.reserved_quantity) <= i.low_stock_threshold
      and p.is_archived = false
    order by (i.quantity - i.reserved_quantity) asc
    limit v_limit
  ) s;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', product_id,
        'productName', product_name,
        'sku', sku,
        'available', available,
        'threshold', threshold,
        'status', status
      )
    ),
    '[]'::jsonb
  )
  into v_out
  from (
    select
      p.id::text as product_id,
      p.name as product_name,
      pv.sku,
      (i.quantity - i.reserved_quantity) as available,
      i.low_stock_threshold as threshold,
      'out_of_stock' as status
    from inventory i
    join product_variants pv on pv.id = i.variant_id
    join products p on p.id = pv.product_id
    where (i.quantity - i.reserved_quantity) <= 0
      and p.is_archived = false
    order by p.name
    limit v_limit
  ) s;

  return jsonb_build_object('lowStock', v_low, 'outOfStock', v_out);
end;
$$;

revoke all on function admin_vn_day_start(timestamptz) from public;
revoke all on function admin_vn_month_start(timestamptz) from public;
revoke all on function admin_dashboard_kpis(timestamptz) from public;
revoke all on function admin_revenue_by_day(int, timestamptz) from public;
revoke all on function admin_orders_by_status() from public;
revoke all on function admin_revenue_by_category(int, timestamptz) from public;
revoke all on function admin_top_products(int, text, int, timestamptz) from public;
revoke all on function admin_stock_alerts(int) from public;
