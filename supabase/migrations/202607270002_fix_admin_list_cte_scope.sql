create or replace function public.admin_list_products(
  p_search text default null,
  p_status text default 'all',
  p_category_id uuid default null,
  p_brand_id uuid default null,
  p_stock text default 'all',
  p_sort text default 'updated_at',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_offset integer := (v_page - 1) * v_size;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := coalesce(nullif(trim(p_status), ''), 'all');
  v_stock text := coalesce(nullif(trim(p_stock), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'updated_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total integer;
  v_rows jsonb;
begin
  if v_status not in ('all', 'published', 'draft', 'archived') then v_status := 'all'; end if;
  if v_stock not in ('all', 'in', 'low', 'out') then v_stock := 'all'; end if;
  if v_sort not in ('name', 'updated_at', 'stock', 'price') then v_sort := 'updated_at'; end if;

  with base as (
    select
      p.id,
      p.name,
      p.slug,
      p.is_published,
      p.is_featured,
      p.is_archived,
      p.updated_at,
      c.name as category_name,
      b.name as brand_name,
      (
        select pi.url
        from product_images pi
        where pi.product_id = p.id
        order by pi.sort_order, pi.created_at
        limit 1
      ) as image_url,
      (
        select count(*)::integer
        from product_variants pv
        where pv.product_id = p.id
      ) as variant_count,
      (
        select coalesce(sum(greatest(i.quantity - i.reserved_quantity, 0)), 0)::integer
        from product_variants pv
        left join inventory i on i.variant_id = pv.id
        where pv.product_id = p.id
      ) as total_available,
      (
        select min(coalesce(pv.sale_price, pv.regular_price))
        from product_variants pv
        where pv.product_id = p.id and pv.is_active
      ) as min_price,
      (
        select max(coalesce(pv.sale_price, pv.regular_price))
        from product_variants pv
        where pv.product_id = p.id and pv.is_active
      ) as max_price
    from products p
    left join categories c on c.id = p.category_id
    left join brands b on b.id = p.brand_id
    where
      (
        v_status = 'all'
        or (v_status = 'published' and p.is_published and not p.is_archived)
        or (v_status = 'draft' and not p.is_published and not p.is_archived)
        or (v_status = 'archived' and p.is_archived)
      )
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_brand_id is null or p.brand_id = p_brand_id)
      and (
        v_search is null
        or p.name ilike '%' || v_search || '%'
        or p.slug ilike '%' || v_search || '%'
        or exists (
          select 1
          from product_variants pv
          where pv.product_id = p.id
            and pv.sku ilike '%' || v_search || '%'
        )
      )
  ),
  filtered as (
    select *
    from base
    where
      v_stock = 'all'
      or (v_stock = 'out' and total_available <= 0)
      or (
        v_stock = 'low'
        and total_available > 0
        and exists (
          select 1
          from product_variants pv
          join inventory i on i.variant_id = pv.id
          where pv.product_id = base.id
            and (i.quantity - i.reserved_quantity) > 0
            and (i.quantity - i.reserved_quantity) <= i.low_stock_threshold
        )
      )
      or (
        v_stock = 'in'
        and total_available > 0
        and not exists (
          select 1
          from product_variants pv
          join inventory i on i.variant_id = pv.id
          where pv.product_id = base.id
            and (i.quantity - i.reserved_quantity) > 0
            and (i.quantity - i.reserved_quantity) <= i.low_stock_threshold
        )
      )
  )
  select
    (select count(*)::integer from filtered),
    (
      select coalesce(jsonb_agg(to_jsonb(x) - 'ord' order by ord), '[]'::jsonb)
      from (
        select
          f.id::text as id,
          f.name,
          f.slug,
          f.is_published as "isPublished",
          f.is_featured as "isFeatured",
          f.is_archived as "isArchived",
          f.updated_at as "updatedAt",
          f.category_name as "categoryName",
          f.brand_name as "brandName",
          f.image_url as "imageUrl",
          f.variant_count as "variantCount",
          f.total_available as "totalAvailable",
          f.min_price as "minPrice",
          f.max_price as "maxPrice",
          row_number() over (
            order by
              case when v_sort = 'name' and v_dir = 'asc' then f.name end asc nulls last,
              case when v_sort = 'name' and v_dir = 'desc' then f.name end desc nulls last,
              case when v_sort = 'stock' and v_dir = 'asc' then f.total_available end asc nulls last,
              case when v_sort = 'stock' and v_dir = 'desc' then f.total_available end desc nulls last,
              case when v_sort = 'price' and v_dir = 'asc' then f.min_price end asc nulls last,
              case when v_sort = 'price' and v_dir = 'desc' then f.min_price end desc nulls last,
              case when v_sort = 'updated_at' and v_dir = 'asc' then f.updated_at end asc nulls last,
              case when v_sort = 'updated_at' and v_dir = 'desc' then f.updated_at end desc nulls last,
              f.updated_at desc
          ) as ord
        from filtered f
        order by
          case when v_sort = 'name' and v_dir = 'asc' then f.name end asc nulls last,
          case when v_sort = 'name' and v_dir = 'desc' then f.name end desc nulls last,
          case when v_sort = 'stock' and v_dir = 'asc' then f.total_available end asc nulls last,
          case when v_sort = 'stock' and v_dir = 'desc' then f.total_available end desc nulls last,
          case when v_sort = 'price' and v_dir = 'asc' then f.min_price end asc nulls last,
          case when v_sort = 'price' and v_dir = 'desc' then f.min_price end desc nulls last,
          case when v_sort = 'updated_at' and v_dir = 'asc' then f.updated_at end asc nulls last,
          case when v_sort = 'updated_at' and v_dir = 'desc' then f.updated_at end desc nulls last,
          f.updated_at desc
        offset v_offset
        limit v_size
      ) x
    )
  into v_total, v_rows;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'pageCount', case when v_total = 0 then 1 else ceil(v_total::numeric / v_size)::integer end,
    'rows', v_rows
  );
end;
$$;

create or replace function public.admin_list_inventory(
  p_search text default null,
  p_stock text default 'all',
  p_category_id uuid default null,
  p_brand_id uuid default null,
  p_sort text default 'updated_at',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_offset integer := (v_page - 1) * v_size;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_stock text := coalesce(nullif(trim(p_stock), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'updated_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total integer;
  v_rows jsonb;
begin
  if v_stock not in ('all', 'in', 'low', 'out') then v_stock := 'all'; end if;
  if v_sort not in ('updated_at', 'available', 'sku', 'name') then v_sort := 'updated_at'; end if;

  with base as (
    select
      i.id as inventory_id,
      i.variant_id,
      i.quantity as on_hand,
      i.reserved_quantity as reserved,
      i.quantity - i.reserved_quantity as available,
      i.low_stock_threshold as threshold,
      i.updated_at,
      pv.sku,
      pv.attributes,
      p.id as product_id,
      p.name as product_name,
      c.name as category_name,
      b.name as brand_name,
      (
        select pi.url
        from product_images pi
        where pi.product_id = p.id
        order by pi.sort_order, pi.created_at
        limit 1
      ) as image_url,
      case
        when i.quantity - i.reserved_quantity <= 0 then 'out_of_stock'
        when i.quantity - i.reserved_quantity <= i.low_stock_threshold then 'low_stock'
        else 'in_stock'
      end as stock_status
    from inventory i
    join product_variants pv on pv.id = i.variant_id
    join products p on p.id = pv.product_id
    left join categories c on c.id = p.category_id
    left join brands b on b.id = p.brand_id
    where not p.is_archived
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_brand_id is null or p.brand_id = p_brand_id)
      and (
        v_search is null
        or p.name ilike '%' || v_search || '%'
        or pv.sku ilike '%' || v_search || '%'
      )
  ),
  filtered as (
    select *
    from base
    where
      v_stock = 'all'
      or (v_stock = 'out' and stock_status = 'out_of_stock')
      or (v_stock = 'low' and stock_status = 'low_stock')
      or (v_stock = 'in' and stock_status = 'in_stock')
  )
  select
    (select count(*)::integer from filtered),
    (
      select coalesce(jsonb_agg(to_jsonb(x) - 'ord' order by ord), '[]'::jsonb)
      from (
        select
          f.inventory_id::text as "inventoryId",
          f.variant_id::text as "variantId",
          f.product_id::text as "productId",
          f.product_name as "productName",
          f.sku,
          f.attributes,
          f.on_hand as "onHand",
          f.reserved,
          f.available,
          f.threshold,
          f.stock_status as "stockStatus",
          f.category_name as "categoryName",
          f.brand_name as "brandName",
          f.image_url as "imageUrl",
          f.updated_at as "updatedAt",
          row_number() over (
            order by
              case when v_sort = 'available' and v_dir = 'asc' then f.available end asc nulls last,
              case when v_sort = 'available' and v_dir = 'desc' then f.available end desc nulls last,
              case when v_sort = 'sku' and v_dir = 'asc' then f.sku end asc nulls last,
              case when v_sort = 'sku' and v_dir = 'desc' then f.sku end desc nulls last,
              case when v_sort = 'name' and v_dir = 'asc' then f.product_name end asc nulls last,
              case when v_sort = 'name' and v_dir = 'desc' then f.product_name end desc nulls last,
              case when v_sort = 'updated_at' and v_dir = 'asc' then f.updated_at end asc nulls last,
              case when v_sort = 'updated_at' and v_dir = 'desc' then f.updated_at end desc nulls last,
              f.updated_at desc
          ) as ord
        from filtered f
        order by
          case when v_sort = 'available' and v_dir = 'asc' then f.available end asc nulls last,
          case when v_sort = 'available' and v_dir = 'desc' then f.available end desc nulls last,
          case when v_sort = 'sku' and v_dir = 'asc' then f.sku end asc nulls last,
          case when v_sort = 'sku' and v_dir = 'desc' then f.sku end desc nulls last,
          case when v_sort = 'name' and v_dir = 'asc' then f.product_name end asc nulls last,
          case when v_sort = 'name' and v_dir = 'desc' then f.product_name end desc nulls last,
          case when v_sort = 'updated_at' and v_dir = 'asc' then f.updated_at end asc nulls last,
          case when v_sort = 'updated_at' and v_dir = 'desc' then f.updated_at end desc nulls last,
          f.updated_at desc
        offset v_offset
        limit v_size
      ) x
    )
  into v_total, v_rows;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'pageCount', case when v_total = 0 then 1 else ceil(v_total::numeric / v_size)::integer end,
    'rows', v_rows
  );
end;
$$;
