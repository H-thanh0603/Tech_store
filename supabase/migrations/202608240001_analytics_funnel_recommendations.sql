-- First-party, PII-free storefront analytics and rule-based recommendations.
-- Browser writes go through /api/analytics/events; raw table access stays private.

create table analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'hero_cta_click', 'category_click', 'search_performed', 'search_no_result',
    'filter_applied', 'sort_changed', 'product_viewed', 'variant_selected',
    'add_to_cart', 'remove_from_cart', 'begin_checkout', 'checkout_error',
    'order_completed', 'wishlist_toggle', 'compare_toggle', 'guide_opened',
    'mini_cart_open', 'recently_viewed_click', 'web_vital'
  )),
  session_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index analytics_events_funnel_idx
  on analytics_events (event_name, occurred_at, session_id);

create index if not exists order_items_variant_id_idx on order_items (variant_id);

alter table analytics_events enable row level security;
revoke all on analytics_events from anon, authenticated;
grant select, insert on analytics_events to service_role;
grant usage, select on sequence analytics_events_id_seq to service_role;

create function admin_sales_funnel(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scoped as (
    select session_id, event_name, occurred_at
    from analytics_events
    where occurred_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))
  ), searches as (
    select session_id, min(occurred_at) as searched_at
    from scoped where event_name = 'search_performed' group by session_id
  ), products as (
    select search.session_id, search.searched_at, min(event.occurred_at) as product_at
    from searches search
    left join scoped event on event.session_id = search.session_id
      and event.event_name = 'product_viewed' and event.occurred_at >= search.searched_at
    group by search.session_id, search.searched_at
  ), carts as (
    select product.*, min(event.occurred_at) as cart_at
    from products product
    left join scoped event on event.session_id = product.session_id
      and event.event_name = 'add_to_cart' and event.occurred_at >= product.product_at
    group by product.session_id, product.searched_at, product.product_at
  ), checkouts as (
    select cart.*, min(event.occurred_at) as checkout_at
    from carts cart
    left join scoped event on event.session_id = cart.session_id
      and event.event_name = 'begin_checkout' and event.occurred_at >= cart.cart_at
    group by cart.session_id, cart.searched_at, cart.product_at, cart.cart_at
  ), event_times as (
    select checkout.*, min(event.occurred_at) as ordered_at
    from checkouts checkout
    left join scoped event on event.session_id = checkout.session_id
      and event.event_name = 'order_completed' and event.occurred_at >= checkout.checkout_at
    group by checkout.session_id, checkout.searched_at, checkout.product_at,
      checkout.cart_at, checkout.checkout_at
  ), counts as (
    select
      count(*) filter (where searched_at is not null) as search_count,
      count(*) filter (where product_at is not null) as product_count,
      count(*) filter (where cart_at is not null) as cart_count,
      count(*) filter (where checkout_at is not null) as checkout_count,
      count(*) filter (where ordered_at is not null) as order_count
    from event_times
  )
  select jsonb_build_array(
    jsonb_build_object('stage', 'search', 'count', search_count),
    jsonb_build_object('stage', 'product', 'count', product_count),
    jsonb_build_object('stage', 'cart', 'count', cart_count),
    jsonb_build_object('stage', 'checkout', 'count', checkout_count),
    jsonb_build_object('stage', 'order', 'count', order_count)
  )
  from counts;
$$;

revoke all on function admin_sales_funnel(integer) from public, anon, authenticated;
grant execute on function admin_sales_funnel(integer) to service_role;

create function recommend_products(p_product_id uuid, p_limit integer default 4)
returns table (
  id uuid,
  name text,
  slug text,
  category_slug text,
  brand_name text,
  min_price numeric,
  has_discount boolean,
  available_stock bigint,
  image_url text,
  image_alt text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_product as (
    select catalog.category_id, catalog.min_price
    from catalog_products catalog
    where catalog.id = p_product_id
  ), sales as (
    select pv.product_id, coalesce(sum(oi.quantity), 0)::numeric as purchases
    from order_items oi
    join orders o on o.id = oi.order_id
    join product_variants pv on pv.id = oi.variant_id
    where o.order_status not in ('cancelled', 'expired')
    group by pv.product_id
  ), reviews as (
    select product_id, avg(rating)::numeric as rating, count(*)::numeric as review_count
    from product_reviews
    where is_published
    group by product_id
  )
  select
    candidate.id,
    candidate.name,
    candidate.slug,
    candidate.category_slug,
    candidate.brand_name,
    candidate.min_price,
    coalesce(candidate.has_discount, false),
    candidate.available_stock,
    candidate.image_url,
    candidate.image_alt
  from catalog_products candidate
  cross join current_product current
  left join sales on sales.product_id = candidate.id
  left join reviews on reviews.product_id = candidate.id
  where candidate.id <> p_product_id
    and candidate.available_stock > 0
  order by
    (
      case when candidate.category_id = current.category_id then 50 else 0 end
      + 25 * greatest(
          0,
          1 - abs(candidate.min_price - current.min_price) / greatest(current.min_price, 1)
        )
      + least(candidate.available_stock, 20)::numeric / 2
      + ln(1 + coalesce(sales.purchases, 0)) * 8
      + coalesce(reviews.rating, 0) * 4
      + ln(1 + coalesce(reviews.review_count, 0)) * 2
    ) desc,
    candidate.is_featured desc,
    candidate.created_at desc
  limit least(greatest(p_limit, 1), 12);
$$;

revoke all on function recommend_products(uuid, integer) from public;
grant execute on function recommend_products(uuid, integer) to anon, authenticated, service_role;
