-- Phase 4: inventory adjustments + admin catalog/inventory RPCs.
-- on-hand = inventory.quantity
-- reserved = inventory.reserved_quantity
-- available = quantity - reserved_quantity (must stay >= 0)

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory (id) on delete restrict,
  variant_id uuid not null references product_variants (id) on delete restrict,
  previous_quantity integer not null check (previous_quantity >= 0),
  delta integer not null,
  new_quantity integer not null check (new_quantity >= 0),
  reason_code text not null check (
    reason_code in ('restock', 'correction', 'damaged', 'returned', 'manual_adjustment')
  ),
  note text,
  actor_label text not null default 'admin',
  created_at timestamptz not null default now(),
  check (new_quantity = previous_quantity + delta)
);

create index inventory_adjustments_variant_id_idx on inventory_adjustments (variant_id);
create index inventory_adjustments_inventory_id_idx on inventory_adjustments (inventory_id);
create index inventory_adjustments_created_at_idx on inventory_adjustments (created_at desc);

alter table inventory_adjustments enable row level security;
-- No anon policies: service-role only via Next.js admin.

-- Atomic inventory adjustment with row lock. Rejects if available would go negative.
create or replace function admin_adjust_inventory(
  p_variant_id uuid,
  p_delta integer,
  p_reason_code text,
  p_note text default null,
  p_actor_label text default 'admin',
  p_expected_quantity integer default null,
  p_low_stock_threshold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv inventory%rowtype;
  v_prev int;
  v_new int;
  v_available int;
  v_adj_id uuid;
begin
  if p_variant_id is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Thiếu variant.');
  end if;
  if p_delta is null or p_delta = 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Delta phải khác 0.');
  end if;
  if p_reason_code is null or p_reason_code not in (
    'restock', 'correction', 'damaged', 'returned', 'manual_adjustment'
  ) then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Reason code không hợp lệ.');
  end if;

  select * into v_inv
  from inventory
  where variant_id = p_variant_id
  for update;

  if not found then
    return jsonb_build_object('code', 'NOT_FOUND', 'message', 'Không tìm thấy tồn kho.');
  end if;

  if p_expected_quantity is not null and v_inv.quantity <> p_expected_quantity then
    return jsonb_build_object(
      'code', 'CONFLICT',
      'message', 'Tồn kho đã thay đổi. Tải lại và thử lại.',
      'currentQuantity', v_inv.quantity
    );
  end if;

  v_prev := v_inv.quantity;
  v_new := v_prev + p_delta;
  if v_new < 0 then
    return jsonb_build_object('code', 'STOCK_CONSTRAINT', 'message', 'Số lượng không được âm.');
  end if;

  v_available := v_new - v_inv.reserved_quantity;
  if v_available < 0 then
    return jsonb_build_object(
      'code', 'STOCK_CONSTRAINT',
      'message', 'Tồn khả dụng không được âm (còn hàng đang giữ chỗ).'
    );
  end if;

  update inventory
  set
    quantity = v_new,
    low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
    updated_at = now()
  where id = v_inv.id
  returning * into v_inv;

  insert into inventory_adjustments (
    inventory_id, variant_id, previous_quantity, delta, new_quantity,
    reason_code, note, actor_label
  )
  values (
    v_inv.id, p_variant_id, v_prev, p_delta, v_new,
    p_reason_code, nullif(trim(coalesce(p_note, '')), ''), coalesce(nullif(trim(p_actor_label), ''), 'admin')
  )
  returning id into v_adj_id;

  return jsonb_build_object(
    'code', 'OK',
    'adjustmentId', v_adj_id,
    'previousQuantity', v_prev,
    'delta', p_delta,
    'newQuantity', v_new,
    'reservedQuantity', v_inv.reserved_quantity,
    'available', v_new - v_inv.reserved_quantity,
    'lowStockThreshold', v_inv.low_stock_threshold
  );
end;
$$;

create or replace function admin_list_inventory(
  p_search text default null,
  p_stock text default 'all',
  p_category_id uuid default null,
  p_brand_id uuid default null,
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
  v_stock text := coalesce(nullif(trim(p_stock), ''), 'all');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'updated_at');
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total int := 0;
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
      (i.quantity - i.reserved_quantity) as available,
      i.low_stock_threshold as threshold,
      i.updated_at,
      pv.sku,
      pv.attributes,
      p.id as product_id,
      p.name as product_name,
      c.name as category_name,
      b.name as brand_name,
      (
        select pi.url from product_images pi
        where pi.product_id = p.id
        order by pi.sort_order, pi.created_at
        limit 1
      ) as image_url,
      case
        when (i.quantity - i.reserved_quantity) <= 0 then 'out_of_stock'
        when (i.quantity - i.reserved_quantity) <= i.low_stock_threshold then 'low_stock'
        else 'in_stock'
      end as stock_status
    from inventory i
    join product_variants pv on pv.id = i.variant_id
    join products p on p.id = pv.product_id
    left join categories c on c.id = p.category_id
    left join brands b on b.id = p.brand_id
    where p.is_archived = false
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_brand_id is null or p.brand_id = p_brand_id)
      and (
        v_search is null
        or p.name ilike '%' || v_search || '%'
        or pv.sku ilike '%' || v_search || '%'
      )
  ),
  filtered as (
    select * from base
    where
      v_stock = 'all'
      or (v_stock = 'out' and stock_status = 'out_of_stock')
      or (v_stock = 'low' and stock_status = 'low_stock')
      or (v_stock = 'in' and stock_status = 'in_stock')
  )
  select count(*)::int into v_total from filtered;

  select coalesce(jsonb_agg(to_jsonb(x) - 'ord'), '[]'::jsonb)
  into v_rows
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
      1 as ord
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

create or replace function admin_list_inventory_adjustments(
  p_variant_id uuid,
  p_limit int default 20
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'previousQuantity', previous_quantity,
        'delta', delta,
        'newQuantity', new_quantity,
        'reasonCode', reason_code,
        'note', note,
        'actorLabel', actor_label,
        'createdAt', created_at
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select *
    from inventory_adjustments
    where variant_id = p_variant_id
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) s;
$$;

revoke all on function admin_adjust_inventory(uuid, integer, text, text, text, integer, integer) from public;
revoke all on function admin_list_inventory(text, text, uuid, uuid, text, text, int, int) from public;
revoke all on function admin_list_inventory_adjustments(uuid, int) from public;
