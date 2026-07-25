-- Server-side admin product list: search, filter, sort, pagination.
-- Service-role only (called from Next.js admin queries).

create or replace function admin_list_products(
  p_search text default null,
  p_status text default 'all',
  p_category_id uuid default null,
  p_brand_id uuid default null,
  p_stock text default 'all',
  p_sort text default 'updated_at',
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
  v_status text := coalesce(nullif(trim(p_status), ''), 'all');
  v_stock text := coalesce(nullif(trim(p_stock), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'updated_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total int := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if v_status not in ('all', 'published', 'draft', 'archived') then
    v_status := 'all';
  end if;
  if v_stock not in ('all', 'in', 'low', 'out') then
    v_stock := 'all';
  end if;
  if v_sort not in ('name', 'updated_at', 'stock', 'price') then
    v_sort := 'updated_at';
  end if;

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
        order by pi.sort_order asc, pi.created_at asc
        limit 1
      ) as image_url,
      (
        select count(*)::int
        from product_variants pv
        where pv.product_id = p.id
      ) as variant_count,
      (
        select coalesce(sum(greatest(i.quantity - i.reserved_quantity, 0)), 0)::int
        from product_variants pv
        left join inventory i on i.variant_id = pv.id
        where pv.product_id = p.id
      ) as total_available,
      (
        select min(coalesce(pv.sale_price, pv.regular_price))
        from product_variants pv
        where pv.product_id = p.id and pv.is_active = true
      ) as min_price,
      (
        select max(coalesce(pv.sale_price, pv.regular_price))
        from product_variants pv
        where pv.product_id = p.id and pv.is_active = true
      ) as max_price,
      (
        select string_agg(pv.sku, ' ')
        from product_variants pv
        where pv.product_id = p.id
      ) as skus
    from products p
    left join categories c on c.id = p.category_id
    left join brands b on b.id = p.brand_id
    where
      (
        v_status = 'all'
        or (v_status = 'published' and p.is_published = true and p.is_archived = false)
        or (v_status = 'draft' and p.is_published = false and p.is_archived = false)
        or (v_status = 'archived' and p.is_archived = true)
      )
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_brand_id is null or p.brand_id = p_brand_id)
      and (
        v_search is null
        or p.name ilike '%' || v_search || '%'
        or p.slug ilike '%' || v_search || '%'
        or exists (
          select 1 from product_variants pv
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
  select count(*)::int into v_total from filtered;

  select coalesce(
    jsonb_agg(to_jsonb(x) order by ord),
    '[]'::jsonb
  )
  into v_rows
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

revoke all on function admin_list_products(text, text, uuid, uuid, text, text, text, int, int) from public;
