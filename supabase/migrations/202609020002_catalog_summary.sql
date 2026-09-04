-- DB-022: catalog_products computed 7 correlated subqueries per row (min_price,
-- has_discount, available_stock, use_cases, image_url, image_alt) on every
-- storefront query. The five static facets move to a trigger-maintained
-- product_catalog_summary table; the view keeps one dynamic expression
-- (available_stock) because reservation expiry is time-based, not event-based.
-- Column names/types/order are unchanged, so every consumer (PostgREST
-- queries, recommend_products, admin lists) keeps working.

create table product_catalog_summary (
  product_id uuid primary key references products (id) on delete cascade,
  min_price numeric,
  has_discount boolean not null default false,
  use_cases text[],
  image_url text,
  image_alt text,
  updated_at timestamptz not null default now()
);

alter table product_catalog_summary enable row level security;
revoke all on product_catalog_summary from public, anon, authenticated;
-- The summary feeds catalog_products (security_invoker), so anon/authenticated
-- need SELECT for the view to stay readable. Contents are public catalog data
-- (prices, first image, use cases) — no PII, no stock internals.
grant select on product_catalog_summary to anon, authenticated;
grant select, insert, update, delete on product_catalog_summary to service_role;

create policy product_catalog_summary_public_read on product_catalog_summary
  for select to anon, authenticated
  using (true);

create index if not exists product_catalog_summary_min_price_idx
  on product_catalog_summary (min_price);

-- Recompute one product's summary row from its children.
create or replace function product_catalog_summary_upsert(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into product_catalog_summary (product_id, min_price, has_discount, use_cases, image_url, image_alt, updated_at)
  values (
    p_product_id,
    (
      select min(coalesce(v.sale_price, v.regular_price))
      from product_variants v
      where v.product_id = p_product_id and v.is_active = true
    ),
    coalesce((
      select bool_or(v.sale_price is not null and v.sale_price < v.regular_price)
      from product_variants v
      where v.product_id = p_product_id and v.is_active = true
    ), false),
    (
      select coalesce(array_agg(uc.use_case order by uc.use_case), '{}')
      from product_use_cases uc
      where uc.product_id = p_product_id
    ),
    (
      select pi.url
      from product_images pi
      where pi.product_id = p_product_id
      order by pi.sort_order, pi.id
      limit 1
    ),
    (
      select pi.alt_text
      from product_images pi
      where pi.product_id = p_product_id
      order by pi.sort_order, pi.id
      limit 1
    ),
    now()
  )
  on conflict (product_id) do update
  set min_price = excluded.min_price,
      has_discount = excluded.has_discount,
      use_cases = excluded.use_cases,
      image_url = excluded.image_url,
      image_alt = excluded.image_alt,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function product_catalog_summary_upsert(uuid) from public, anon, authenticated;

-- Trigger router: variant/image/use-case writes maintain the summary.
-- product_id exists on product_variants/product_images/product_use_cases; for
-- a products INSERT/DELETE trigger the row itself carries id, hence the
-- coalesce. A cascade from a deleted product fires child DELETE triggers
-- after the parent row is gone: drop the summary row instead of re-inserting
-- it (otherwise the FK blocks legitimate hard deletes of unsold products).
create or replace function product_catalog_summary_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid;
begin
  if tg_table_name = 'products' then
    v_product := coalesce(new.id, old.id);
  else
    v_product := coalesce(new.product_id, old.product_id);
  end if;
  if v_product is null then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from products p where p.id = v_product) then
    delete from product_catalog_summary where product_id = v_product;
  else
    perform product_catalog_summary_upsert(v_product);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function product_catalog_summary_touch() from public, anon, authenticated;

create trigger catalog_summary_variants
after insert or update or delete on product_variants
for each row execute function product_catalog_summary_touch();

-- Products rows always have a summary row (inner join in the view), including
-- drafts with no variants yet. The DELETE twin covers childless products;
-- products with children are cleaned by the child triggers above.
create trigger catalog_summary_products
after insert on products
for each row execute function product_catalog_summary_touch();

create trigger catalog_summary_products_del
after delete on products
for each row execute function product_catalog_summary_touch();

create trigger catalog_summary_images
after insert or update or delete on product_images
for each row execute function product_catalog_summary_touch();

create trigger catalog_summary_use_cases
after insert or delete on product_use_cases
for each row execute function product_catalog_summary_touch();

-- Backfill: one summary row per product. Idempotent.
create or replace function product_catalog_summary_refresh()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from products;
  perform product_catalog_summary_upsert(p.id) from products p;
  return v_count;
end;
$$;

revoke all on function product_catalog_summary_refresh() from public, anon, authenticated;
grant execute on function product_catalog_summary_refresh() to service_role;

select product_catalog_summary_refresh();

-- Replace the view: same columns, static facets from the summary table,
-- available_stock stays reservation-aware (time-based expiry cannot be
-- pre-triggered) but now costs one expression instead of seven.
drop view catalog_products;

create view catalog_products
with (security_invoker = on)
as
select
  p.id,
  p.name,
  p.slug,
  p.description,
  p.is_featured,
  p.created_at,
  p.category_id,
  p.brand_id,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  b.slug as brand_slug,
  s.min_price,
  s.has_discount,
  (
    select coalesce(sum(available_variant_stock(v.id)), 0)
    from product_variants v
    where v.product_id = p.id and v.is_active = true
  ) as available_stock,
  s.use_cases,
  s.image_url,
  s.image_alt,
  p.search_vector,
  p.search_vector_nd
from products p
join product_catalog_summary s on s.product_id = p.id
join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
where p.is_published = true
  and p.is_archived = false
  and c.is_active = true;

grant select on catalog_products to anon, authenticated;
