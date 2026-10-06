-- Attention-first sort for the admin orders list: actionable orders
-- (pending, awaiting_payment, return_requested, ...) surface before
-- completed/cancelled ones. Surgical patch of admin_list_orders only —
-- body is the 202608250013 version verbatim except the sort whitelist
-- and the two attention ORDER BY lines.

create or replace function admin_list_orders(
  p_search text default null,
  p_order_status text default 'all',
  p_payment_status text default 'all',
  p_payment_method text default 'all',
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'created_at',
  p_sort_dir text default 'desc',
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page int := greatest(1, coalesce(p_page, 1));
  v_size int := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_offset int := (v_page - 1) * v_size;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_order_status text := coalesce(nullif(trim(p_order_status), ''), 'all');
  v_payment_status text := coalesce(nullif(trim(p_payment_status), ''), 'all');
  v_payment_method text := coalesce(nullif(trim(p_payment_method), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'created_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total int := 0;
  v_rows jsonb;
begin
  if v_sort not in ('created_at', 'total', 'updated_at', 'attention') then v_sort := 'created_at'; end if;

  with filtered as materialized (
    select
      o.order_code,
      o.customer_name,
      o.customer_phone,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.total,
      o.created_at,
      o.updated_at
    from orders o
    where
      (v_order_status = 'all' or o.order_status = v_order_status)
      and (v_payment_status = 'all' or o.payment_status = v_payment_status)
      and (v_payment_method = 'all' or o.payment_method = v_payment_method)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to)
      and (
        v_search is null
        or o.order_code ilike '%' || upper(v_search) || '%'
        or o.customer_name ilike '%' || v_search || '%'
        or o.customer_phone ilike '%' || v_search || '%'
      )
  ),
  paged as (
    select f.*, count(*) over() as full_count
    from (
      select *
      from filtered
      order by
        case when v_sort = 'attention' then
          case order_status
            when 'pending' then 0
            when 'awaiting_payment' then 1
            when 'return_requested' then 2
            when 'confirmed' then 3
            when 'packing' then 4
            when 'shipping' then 5
            when 'completed' then 6
            else 7
          end
        end asc nulls last,
        case when v_sort = 'attention' then created_at end desc nulls last,
        case when v_sort = 'total' and v_dir = 'asc' then total end asc nulls last,
        case when v_sort = 'total' and v_dir = 'desc' then total end desc nulls last,
        case when v_sort = 'updated_at' and v_dir = 'asc' then updated_at end asc nulls last,
        case when v_sort = 'updated_at' and v_dir = 'desc' then updated_at end desc nulls last,
        case when v_sort = 'created_at' and v_dir = 'asc' then created_at end asc nulls last,
        case when v_sort = 'created_at' and v_dir = 'desc' then created_at end desc nulls last,
        created_at desc
      offset v_offset
      limit v_size
    ) f
  )
  select
    coalesce(jsonb_agg(to_jsonb(x) - 'full_count'), '[]'::jsonb),
    coalesce(max(x.full_count), 0)::int
  into v_rows, v_total
  from (
    select
      p.order_code as "orderCode",
      p.customer_name as "customerName",
      p.customer_phone as "customerPhone",
      p.payment_method as "paymentMethod",
      p.payment_status as "paymentStatus",
      p.order_status as "orderStatus",
      p.total,
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      row_number() over (order by p.created_at desc) as ord,
      p.full_count
    from paged p
  ) x;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'pageCount', case when v_total = 0 then 1 else ceil(v_total::numeric / v_size)::int end,
    'rows', v_rows
  );
end;
$$;
revoke all on function admin_list_orders(text, text, text, text, timestamptz, timestamptz, text, text, int, int) from public;
grant execute on function admin_list_orders(text, text, text, text, timestamptz, timestamptz, text, text, int, int) to service_role;
