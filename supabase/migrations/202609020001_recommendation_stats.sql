-- DB-023: recommend_products no longer full-aggregates order_items and
-- product_reviews on every PDP view. Purchases/rating/review_count are
-- maintained in a product_recommendation_stats table by triggers, and the RPC
-- reads the pre-computed counters. Backfill + refresh functions keep the
-- table correct after bulk imports/returns.

create table product_recommendation_stats (
  product_id uuid primary key references products (id) on delete cascade,
  purchase_count numeric not null default 0,
  review_rating numeric not null default 0,
  review_count numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table product_recommendation_stats enable row level security;
revoke all on product_recommendation_stats from public, anon, authenticated;
grant select, insert, update, delete on product_recommendation_stats to service_role;

-- Single-row upsert of one product's counters. SECURITY DEFINER so triggers
-- on order_items/product_reviews (fired under anon/authenticated writes via
-- definer RPCs) can maintain the counters without table grants.
create or replace function product_recommendation_stats_upsert(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into product_recommendation_stats (product_id, purchase_count, review_rating, review_count, updated_at)
  values (
    p_product_id,
    coalesce((
      select sum(oi.quantity)
      from order_items oi
      join orders o on o.id = oi.order_id
      join product_variants pv on pv.id = oi.variant_id
      where pv.product_id = p_product_id
        and o.order_status not in ('cancelled', 'expired')
    ), 0)::numeric,
    coalesce((
      select avg(rating)
      from product_reviews
      where product_id = p_product_id and is_published
    ), 0)::numeric,
    coalesce((
      select count(*)
      from product_reviews
      where product_id = p_product_id and is_published
    ), 0)::numeric,
    now()
  )
  on conflict (product_id) do update
  set purchase_count = excluded.purchase_count,
      review_rating = excluded.review_rating,
      review_count = excluded.review_count,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function product_recommendation_stats_upsert(uuid) from public, anon, authenticated;

-- Trigger: order_items insert/delete changes purchase counts.
create or replace function product_recommendation_stats_order_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_product uuid;
  v_new_product uuid;
begin
  if tg_op = 'DELETE' then
    v_old_product := (select product_id from product_variants where id = old.variant_id);
    if v_old_product is not null then
      perform product_recommendation_stats_upsert(v_old_product);
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    v_new_product := (select product_id from product_variants where id = new.variant_id);
    if v_new_product is not null then
      perform product_recommendation_stats_upsert(v_new_product);
    end if;
    return new;
  end if;

  v_old_product := (select product_id from product_variants where id = old.variant_id);
  v_new_product := (select product_id from product_variants where id = new.variant_id);
  if v_new_product is not null then
    perform product_recommendation_stats_upsert(v_new_product);
  end if;
  if v_old_product is not null and v_old_product is distinct from v_new_product then
    perform product_recommendation_stats_upsert(v_old_product);
  end if;
  return new;
end;
$$;

revoke all on function product_recommendation_stats_order_items() from public, anon, authenticated;

create trigger recommendation_stats_order_items
after insert or delete on order_items
for each row execute function product_recommendation_stats_order_items();

-- order_status transitions (cancel/expire/reopen) also change purchase counts.
create or replace function product_recommendation_stats_orders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.order_status is distinct from old.order_status then
    perform product_recommendation_stats_upsert(pv.product_id)
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    where oi.order_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function product_recommendation_stats_orders() from public, anon, authenticated;

create trigger recommendation_stats_orders
after update of order_status on orders
for each row execute function product_recommendation_stats_orders();

-- Trigger: review insert/update/delete changes rating/count.
create or replace function product_recommendation_stats_reviews()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform product_recommendation_stats_upsert(old.product_id);
    return old;
  end if;
  if new.product_id is not null then
    perform product_recommendation_stats_upsert(new.product_id);
  end if;
  return new;
end;
$$;

revoke all on function product_recommendation_stats_reviews() from public, anon, authenticated;

create trigger recommendation_stats_reviews
after insert or update or delete on product_reviews
for each row execute function product_recommendation_stats_reviews();

-- Backfill from current data. Idempotent; safe to re-run after bulk imports.
create or replace function product_recommendation_stats_refresh(
  p_product_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_touched integer := 0;
begin
  if p_product_id is not null then
    perform product_recommendation_stats_upsert(p_product_id);
    return 1;
  end if;

  select count(*) into v_touched from products;
  perform product_recommendation_stats_upsert(p.id) from products p;

  -- Drop zero-counter rows (products with no live orders or reviews).
  delete from product_recommendation_stats
  where purchase_count = 0 and review_count = 0;

  return v_touched;
end;
$$;

revoke all on function product_recommendation_stats_refresh(uuid) from public, anon, authenticated;
grant execute on function product_recommendation_stats_refresh(uuid) to service_role;

-- Backfill now.
select product_recommendation_stats_refresh();

-- Rewrite recommend_products to join the pre-computed counters.
create or replace function recommend_products(p_product_id uuid, p_limit integer default 4)
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
  cross join (
    select catalog.category_id, catalog.min_price
    from catalog_products catalog
    where catalog.id = p_product_id
  ) current_product
  left join product_recommendation_stats stats on stats.product_id = candidate.id
  where candidate.id <> p_product_id
    and candidate.available_stock > 0
  order by
    (
      case when candidate.category_id = current_product.category_id then 50 else 0 end
      + 25 * greatest(
          0,
          1 - abs(candidate.min_price - current_product.min_price) / greatest(current_product.min_price, 1)
        )
      + least(candidate.available_stock, 20)::numeric / 2
      + ln(1 + coalesce(stats.purchase_count, 0)) * 8
      + coalesce(stats.review_rating, 0) * 4
      + ln(1 + coalesce(stats.review_count, 0)) * 2
    ) desc,
    candidate.is_featured desc,
    candidate.created_at desc
  limit least(greatest(p_limit, 1), 12);
$$;

revoke all on function recommend_products(uuid, integer) from public;
grant execute on function recommend_products(uuid, integer) to anon, authenticated, service_role;
