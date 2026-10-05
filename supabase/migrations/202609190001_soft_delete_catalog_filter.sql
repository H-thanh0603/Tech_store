-- Soft-delete leakage (2026-09-14 retention batch added products/variants/
-- categories/brands.deleted_at but never filtered them in the catalog read
-- path): trashed products stayed on the storefront and in the AI assistant's
-- search (e2e junk at 0đ surfaced as "cheapest"). Also product_catalog_summary
-- counted soft-deleted variants into min_price/has_discount.

create or replace view catalog_products
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
    where v.product_id = p.id and v.is_active = true and v.deleted_at is null
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
  and p.deleted_at is null
  and c.is_active = true
  and c.deleted_at is null
  and (b.id is null or b.deleted_at is null);

-- Summary must ignore soft-deleted variants when deriving price/discount.
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
      where v.product_id = p_product_id and v.is_active = true and v.deleted_at is null
    ),
    coalesce((
      select bool_or(v.sale_price is not null and v.sale_price < v.regular_price)
      from product_variants v
      where v.product_id = p_product_id and v.is_active = true and v.deleted_at is null
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

-- Rebuild cached summaries (variant deletions were never re-triggered).
select product_catalog_summary_upsert(id) from products;

-- Matview copy of the catalog (202609140002) must see the new row set.
do $$
begin
  if exists (select 1 from pg_matviews where matviewname = 'catalog_products_cached') then
    refresh materialized view catalog_products_cached;
  end if;
end
$$;
