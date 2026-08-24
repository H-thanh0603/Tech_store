-- Multi-store pickup. Network inventory remains the canonical oversell ceiling;
-- store_inventory is the per-store pickup allocation within that ceiling.

create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  phone text,
  province text not null,
  district text not null,
  street_address text not null,
  opening_hours text not null default '08:00–21:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_inventory (
  store_id uuid not null references stores (id) on delete cascade,
  variant_id uuid not null references product_variants (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, variant_id)
);

create table store_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete restrict,
  store_id uuid not null references stores (id) on delete restrict,
  variant_id uuid not null references product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, variant_id)
);

create index store_inventory_variant_idx on store_inventory (variant_id, store_id);
create index store_inventory_reservations_active_idx
  on store_inventory_reservations (store_id, variant_id, expires_at)
  where released_at is null;

alter table orders
  add column fulfillment_method text not null default 'delivery'
    check (fulfillment_method in ('delivery', 'pickup')),
  add column pickup_store_id uuid references stores (id) on delete restrict,
  add constraint orders_fulfillment_store_check check (
    (fulfillment_method = 'delivery' and pickup_store_id is null)
    or (fulfillment_method = 'pickup' and pickup_store_id is not null)
  );

alter table stores enable row level security;
alter table store_inventory enable row level security;
alter table store_inventory_reservations enable row level security;
revoke all on stores, store_inventory, store_inventory_reservations from public, anon, authenticated;
grant all on stores, store_inventory, store_inventory_reservations to service_role;

create trigger stores_set_updated_at before update on stores
for each row execute function set_updated_at();

create trigger store_inventory_set_updated_at before update on store_inventory
for each row execute function set_updated_at();

create function available_store_stock(p_store_id uuid, p_variant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(least(
    coalesce(si.quantity, 0) - coalesce((
      select sum(sir.quantity)
      from store_inventory_reservations sir
      join orders o on o.id = sir.order_id
      where sir.store_id = p_store_id
        and sir.variant_id = p_variant_id
        and sir.released_at is null
        and (sir.expires_at is null or sir.expires_at > now())
        and o.order_status not in ('cancelled', 'expired')
    ), 0),
    coalesce(available_variant_stock(p_variant_id), 0)
  ), 0)::integer
  from store_inventory si
  where si.store_id = p_store_id and si.variant_id = p_variant_id;
$$;

revoke all on function available_store_stock(uuid, uuid) from public;
grant execute on function available_store_stock(uuid, uuid) to anon, authenticated, service_role;

create function product_pickup_availability(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'storeId', row.store_id,
    'storeName', row.store_name,
    'province', row.province,
    'district', row.district,
    'address', row.street_address,
    'openingHours', row.opening_hours,
    'variantId', row.variant_id,
    'available', row.available
  ) order by row.province, row.store_name, row.variant_id), '[]'::jsonb)
  from (
    select s.id as store_id, s.name as store_name, s.province, s.district,
      s.street_address, s.opening_hours, si.variant_id,
      available_store_stock(s.id, si.variant_id) as available
    from stores s
    join store_inventory si on si.store_id = s.id
    join product_variants v on v.id = si.variant_id and v.product_id = p_product_id and v.is_active
    join products p on p.id = v.product_id and p.is_published and not p.is_archived
    where s.is_active and available_store_stock(s.id, si.variant_id) > 0
  ) row;
$$;

create function pickup_stores_for_cart(p_cart_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', eligible.id,
    'name', eligible.name,
    'phone', eligible.phone,
    'province', eligible.province,
    'district', eligible.district,
    'address', eligible.street_address,
    'openingHours', eligible.opening_hours
  ) order by eligible.province, eligible.name), '[]'::jsonb)
  from (
    select s.*
    from stores s
    where s.is_active
      and exists (
        select 1 from carts c join cart_items ci on ci.cart_id = c.id
        where c.token_hash = p_cart_token_hash and c.status = 'open'
      )
      and not exists (
        select 1
        from carts c
        join cart_items ci on ci.cart_id = c.id
        where c.token_hash = p_cart_token_hash and c.status = 'open'
          and available_store_stock(s.id, ci.variant_id) < ci.quantity
      )
  ) eligible;
$$;

revoke all on function product_pickup_availability(uuid), pickup_stores_for_cart(text) from public;
grant execute on function product_pickup_availability(uuid), pickup_stores_for_cart(text)
  to anon, authenticated, service_role;

-- Keep the established place_order interface. Fulfillment travels inside the
-- already-validated customer snapshot so older callers remain delivery orders.
create or replace function place_order(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfillment text := coalesce(nullif(p_customer->>'fulfillmentMethod', ''), 'delivery');
  v_store_id uuid;
  v_existing orders%rowtype;
  v_result jsonb;
  v_order orders%rowtype;
  v_item record;
  v_store stores%rowtype;
begin
  select * into v_existing from orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
  end if;

  if v_fulfillment not in ('delivery', 'pickup') then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  if v_fulfillment = 'pickup' then
    begin
      v_store_id := nullif(p_customer->>'pickupStoreId', '')::uuid;
    exception when invalid_text_representation then
      return jsonb_build_object('code', 'VALIDATION_ERROR');
    end;

    select * into v_store from stores where id = v_store_id and is_active for share;
    if not found then return jsonb_build_object('code', 'PICKUP_STORE_UNAVAILABLE'); end if;

    for v_item in
      select ci.variant_id, ci.quantity
      from carts c join cart_items ci on ci.cart_id = c.id
      where c.token_hash = p_cart_token_hash and c.status = 'open'
      order by ci.variant_id
    loop
      perform 1 from store_inventory
      where store_id = v_store_id and variant_id = v_item.variant_id
      for update;
      if not found or available_store_stock(v_store_id, v_item.variant_id) < v_item.quantity then
        return jsonb_build_object('code', 'PICKUP_STORE_UNAVAILABLE');
      end if;
    end loop;
  end if;

  v_result := place_order_internal(
    p_cart_token_hash, p_idempotency_key, p_order_access_token_hash,
    p_customer, p_payment_method, p_coupon_code, auth.uid()
  );
  if coalesce(v_result->>'code', '') <> 'OK' then return v_result; end if;

  select * into v_order from orders where order_code = v_result->>'orderCode' for update;
  if v_fulfillment = 'pickup' then
    update orders
    set fulfillment_method = 'pickup', pickup_store_id = v_store_id,
        address_snapshot = jsonb_build_object(
          'province', v_store.province,
          'district', v_store.district,
          'ward', '',
          'streetAddress', v_store.street_address
        )
    where id = v_order.id;

    insert into store_inventory_reservations (
      order_id, store_id, variant_id, quantity, expires_at
    )
    select v_order.id, v_store_id, ci.variant_id, ci.quantity, v_order.transfer_expires_at
    from cart_items ci where ci.cart_id = v_order.cart_id;
  end if;

  return v_result || jsonb_build_object(
    'fulfillmentMethod', v_fulfillment,
    'pickupStore', case when v_fulfillment = 'pickup' then jsonb_build_object(
      'id', v_store.id, 'name', v_store.name, 'address', v_store.street_address,
      'district', v_store.district, 'province', v_store.province,
      'openingHours', v_store.opening_hours
    ) else null end
  );
exception when others then
  return jsonb_build_object('code', 'INTERNAL_ERROR');
end;
$$;

revoke all on function place_order(text, uuid, text, jsonb, text, text) from public;
grant execute on function place_order(text, uuid, text, jsonb, text, text) to anon, authenticated;

-- Releasing the canonical reservation is the shared seam for cancellation,
-- expiry and completion. Keep store reservations synchronized there.
create function sync_store_reservation_release()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_res store_inventory_reservations%rowtype;
  v_status text;
begin
  if old.released_at is not null or new.released_at is null then return new; end if;

  select * into v_store_res
  from store_inventory_reservations
  where order_id = new.order_id and variant_id = new.variant_id and released_at is null
  for update;
  if not found then return new; end if;

  select order_status into v_status from orders where id = new.order_id;
  if v_status = 'completed' then
    update store_inventory
    set quantity = greatest(quantity - v_store_res.quantity, 0)
    where store_id = v_store_res.store_id and variant_id = v_store_res.variant_id;
  end if;

  update store_inventory_reservations set released_at = new.released_at
  where id = v_store_res.id;
  return new;
end;
$$;

create trigger inventory_reservations_sync_store_release
after update of released_at on inventory_reservations
for each row execute function sync_store_reservation_release();

create or replace function order_get_by_access(p_order_code text, p_access_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_items jsonb;
  v_store stores%rowtype;
begin
  select * into v_order from orders
  where order_code = upper(trim(p_order_code)) and access_token_hash = p_access_token_hash;
  if not found then return jsonb_build_object('code', 'ORDER_NOT_FOUND'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', product_name, 'sku', sku, 'attributes', attributes,
    'unitPrice', unit_price, 'quantity', quantity, 'lineTotal', line_total
  ) order by id), '[]'::jsonb)
  into v_items from order_items where order_id = v_order.id;

  if v_order.pickup_store_id is not null then
    select * into v_store from stores where id = v_order.pickup_store_id;
  end if;

  return jsonb_build_object(
    'code', 'OK', 'orderCode', v_order.order_code,
    'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'orderStatus', v_order.order_status, 'subtotal', v_order.subtotal,
    'discountTotal', v_order.discount_total, 'shippingTotal', 0, 'total', v_order.total,
    'transferExpiresAt', v_order.transfer_expires_at, 'items', v_items,
    'fulfillmentMethod', v_order.fulfillment_method,
    'pickupStore', case when v_order.pickup_store_id is null then null else jsonb_build_object(
      'id', v_store.id, 'name', v_store.name, 'phone', v_store.phone,
      'address', v_store.street_address, 'district', v_store.district,
      'province', v_store.province, 'openingHours', v_store.opening_hours
    ) end
  );
end;
$$;

revoke all on function order_get_by_access(text, text) from public;
grant execute on function order_get_by_access(text, text) to anon, authenticated;

create function admin_set_store_stock(
  p_store_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_expected_quantity integer default null,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
  v_global integer;
begin
  if p_quantity < 0 then return jsonb_build_object('code', 'VALIDATION_ERROR'); end if;
  select quantity into v_global from inventory where variant_id = p_variant_id for share;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
  if p_quantity > v_global then return jsonb_build_object('code', 'EXCEEDS_NETWORK_STOCK'); end if;

  select quantity into v_current from store_inventory
  where store_id = p_store_id and variant_id = p_variant_id for update;
  v_current := coalesce(v_current, 0);
  if p_expected_quantity is not null and v_current <> p_expected_quantity then
    return jsonb_build_object('code', 'CONFLICT', 'quantity', v_current);
  end if;

  insert into store_inventory (store_id, variant_id, quantity)
  values (p_store_id, p_variant_id, p_quantity)
  on conflict (store_id, variant_id) do update set quantity = excluded.quantity;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values ('store_stock_set', 'inventory', p_variant_id::text,
    jsonb_build_object('storeId', p_store_id, 'from', v_current, 'to', p_quantity),
    coalesce(nullif(trim(p_actor_label), ''), 'admin'));
  return jsonb_build_object('code', 'OK', 'quantity', p_quantity);
end;
$$;

revoke all on function admin_set_store_stock(uuid, uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function admin_set_store_stock(uuid, uuid, integer, integer, text) to service_role;

insert into stores (id, slug, name, phone, province, district, street_address, opening_hours)
values
  ('92000000-0000-4000-8000-000000000001', 'ho-chi-minh-quan-1', 'TechStore Quận 1', '028 7108 9666', 'TP. Hồ Chí Minh', 'Quận 1', '123 Nguyễn Huệ', '08:00–21:30'),
  ('92000000-0000-4000-8000-000000000002', 'ha-noi-cau-giay', 'TechStore Cầu Giấy', '024 7108 9666', 'Hà Nội', 'Cầu Giấy', '88 Cầu Giấy', '08:00–21:30'),
  ('92000000-0000-4000-8000-000000000003', 'da-nang-hai-chau', 'TechStore Hải Châu', '0236 710 9666', 'Đà Nẵng', 'Hải Châu', '42 Nguyễn Văn Linh', '08:00–21:00')
on conflict (id) do nothing;

-- ponytail: deterministic demo allocations; replace with transfer receipts
-- when store-to-store/warehouse logistics becomes a real workflow.
insert into store_inventory (store_id, variant_id, quantity)
select store_id, variant_id, allocated
from (
  select '92000000-0000-4000-8000-000000000001'::uuid as store_id,
    variant_id, least(quantity, 3) as allocated from inventory
  union all
  select '92000000-0000-4000-8000-000000000002'::uuid,
    variant_id, least(greatest(quantity - 3, 0), 2) from inventory
  union all
  select '92000000-0000-4000-8000-000000000003'::uuid,
    variant_id, least(greatest(quantity - 5, 0), 1) from inventory
) seed
where allocated > 0
on conflict (store_id, variant_id) do nothing;
