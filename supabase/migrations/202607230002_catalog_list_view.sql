-- Read-optimized product list view for the storefront.
-- Product-level price and stock live on child tables (product_variants,
-- inventory), so a flat view is needed to filter/sort/paginate by them in one
-- PostgREST query. security_invoker = on keeps the caller's RLS in force, so
-- anon still sees only published products and their active variants.

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
  (
    select min(coalesce(v.sale_price, v.regular_price))
    from product_variants v
    where v.product_id = p.id and v.is_active = true
  ) as min_price,
  (
    select bool_or(v.sale_price is not null and v.sale_price < v.regular_price)
    from product_variants v
    where v.product_id = p.id and v.is_active = true
  ) as has_discount,
  (
    select coalesce(sum(greatest(inv.quantity - inv.reserved_quantity, 0)), 0)
    from product_variants v
    join inventory inv on inv.variant_id = v.id
    where v.product_id = p.id and v.is_active = true
  ) as available_stock,
  (
    select array_agg(uc.use_case order by uc.use_case)
    from product_use_cases uc
    where uc.product_id = p.id
  ) as use_cases,
  (
    select pi.url
    from product_images pi
    where pi.product_id = p.id
    order by pi.sort_order, pi.id
    limit 1
  ) as image_url,
  (
    select pi.alt_text
    from product_images pi
    where pi.product_id = p.id
    order by pi.sort_order, pi.id
    limit 1
  ) as image_alt,
  p.search_vector
from products p
join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
where p.is_published = true
  and p.is_archived = false
  and c.is_active = true;

grant select on catalog_products to anon, authenticated;
