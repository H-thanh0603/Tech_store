-- Customer auth linkage, order history by user, reviews, flash offers, product hotspots.

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────

create table if not exists customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  address_line text,
  city text,
  district text,
  ward text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_profiles enable row level security;

create policy customer_profiles_select_own on customer_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy customer_profiles_upsert_own on customer_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy customer_profiles_update_own on customer_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── Orders ↔ users ──────────────────────────────────────────────────────────

alter table orders
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists orders_user_id_idx on orders (user_id)
  where user_id is not null;

-- ─── Reviews ─────────────────────────────────────────────────────────────────

create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  author_name text not null check (length(trim(author_name)) between 1 and 80),
  rating integer not null check (rating between 1 and 5),
  title text check (title is null or length(title) <= 120),
  body text not null check (length(trim(body)) between 1 and 2000),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_id_idx
  on product_reviews (product_id)
  where is_published;

alter table product_reviews enable row level security;

create policy product_reviews_public_read on product_reviews
  for select to anon, authenticated
  using (is_published = true);

create policy product_reviews_insert_own on product_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

-- ─── Flash offers ────────────────────────────────────────────────────────────

create table if not exists flash_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  title text not null,
  badge text not null default 'Flash sale',
  ends_at timestamptz not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists flash_offers_active_idx
  on flash_offers (is_active, ends_at)
  where is_active;

alter table flash_offers enable row level security;

create policy flash_offers_public_read on flash_offers
  for select to anon, authenticated
  using (is_active = true and ends_at > now());

-- ─── Product hotspots (PDP interactive) ──────────────────────────────────────

create table if not exists product_hotspots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 80),
  description text not null check (length(trim(description)) between 1 and 400),
  x_percent numeric(5, 2) not null check (x_percent between 0 and 100),
  y_percent numeric(5, 2) not null check (y_percent between 0 and 100),
  sort_order integer not null default 0
);

create index if not exists product_hotspots_product_id_idx on product_hotspots (product_id);

alter table product_hotspots enable row level security;

create policy product_hotspots_public_read on product_hotspots
  for select to anon, authenticated
  using (
    exists (
      select 1 from products p
      where p.id = product_hotspots.product_id
        and p.is_published and not p.is_archived
    )
  );

-- ─── place_order: attach auth.uid() / optional p_user_id ──────────────────────

drop function if exists place_order(text, uuid, text, jsonb, text, text);

create function place_order(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart carts%rowtype;
  v_existing orders%rowtype;
  v_coupon coupons%rowtype;
  v_order_id uuid;
  v_order_code text;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_transfer_expires_at timestamptz;
  v_available integer;
  v_coupon_code text;
  v_item record;
  v_inventory record;
  v_user_id uuid;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$'
     or p_order_access_token_hash !~ '^[a-f0-9]{64}$'
     or p_idempotency_key is null
     or p_payment_method not in ('cod', 'bank_transfer') then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  -- Prefer JWT user; reject spoofed p_user_id when session present.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif p_user_id is not null and p_user_id <> v_user_id then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  select * into v_existing
  from orders
  where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
  end if;

  select * into v_cart
  from carts
  where token_hash = p_cart_token_hash
  for update;
  if not found or v_cart.status <> 'open' then
    if found then
      select * into v_existing from orders where cart_id = v_cart.id order by created_at desc limit 1;
      if found then
        return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
      end if;
    end if;
    return jsonb_build_object('code', 'CART_EMPTY');
  end if;

  if not exists (select 1 from cart_items where cart_id = v_cart.id) then
    return jsonb_build_object('code', 'CART_EMPTY');
  end if;

  for v_item in
    select ci.variant_id
    from cart_items ci
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    select * into v_inventory
    from inventory
    where variant_id = v_item.variant_id
    for update;
    if not found then
      return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', 0);
    end if;
  end loop;

  for v_item in
    select ci.*, v.product_id, v.sku, v.attributes,
      coalesce(v.sale_price, v.regular_price) as current_price,
      p.name as product_name, p.is_published, p.is_archived, v.is_active
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    if not v_item.is_active or not v_item.is_published or v_item.is_archived then
      return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE');
    end if;
    v_available := available_variant_stock(v_item.variant_id);
    if v_available < v_item.quantity then
      return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', v_available);
    end if;
    if v_item.price_at_add <> v_item.current_price then
      return jsonb_build_object('code', 'PRICE_CHANGED');
    end if;
    v_subtotal := v_subtotal + v_item.current_price * v_item.quantity;
  end loop;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon
    from coupons
    where code = upper(trim(p_coupon_code))
    for update;
    if not found or not v_coupon.is_active then
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at <= now() then
      return jsonb_build_object('code', 'COUPON_EXPIRED');
    end if;
    if v_coupon.usage_limit is not null and
       (select count(*) from coupon_redemptions
        where coupon_id = v_coupon.id and released_at is null) >= v_coupon.usage_limit then
      return jsonb_build_object('code', 'COUPON_EXHAUSTED');
    end if;
    if v_subtotal < v_coupon.minimum_order then
      return jsonb_build_object('code', 'COUPON_MINIMUM');
    end if;
    v_discount := least(
      case when v_coupon.discount_type = 'percentage'
        then floor(v_subtotal * v_coupon.discount_value / 100)
        else v_coupon.discount_value end,
      coalesce(v_coupon.maximum_discount, v_subtotal),
      v_subtotal
    );
    v_coupon_code := v_coupon.code;
  elsif v_cart.applied_coupon_id is not null then
    select * into v_coupon from coupons where id = v_cart.applied_coupon_id for update;
    if found and v_coupon.is_active
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.ends_at is null or v_coupon.ends_at > now())
       and (v_coupon.usage_limit is null or
         (select count(*) from coupon_redemptions
          where coupon_id = v_coupon.id and released_at is null) < v_coupon.usage_limit)
       and v_subtotal >= v_coupon.minimum_order then
      v_discount := least(
        case when v_coupon.discount_type = 'percentage'
          then floor(v_subtotal * v_coupon.discount_value / 100)
          else v_coupon.discount_value end,
        coalesce(v_coupon.maximum_discount, v_subtotal),
        v_subtotal
      );
      v_coupon_code := v_coupon.code;
    else
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
  end if;

  v_total := v_subtotal - v_discount;
  if p_payment_method = 'bank_transfer' then
    v_transfer_expires_at := now() + interval '24 hours';
  end if;
  v_order_code := 'TS-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('commerce_order_code_seq')::text, 6, '0');

  insert into orders (
    order_code, cart_id, idempotency_key, access_token_hash,
    customer_name, customer_phone, customer_email, address_snapshot, note,
    payment_method, payment_status, order_status,
    subtotal, discount_total, shipping_total, total, coupon_snapshot,
    transfer_expires_at, user_id
  ) values (
    v_order_code, v_cart.id, p_idempotency_key, p_order_access_token_hash,
    trim(p_customer->>'customerName'), trim(p_customer->>'customerPhone'),
    nullif(trim(p_customer->>'customerEmail'), ''),
    jsonb_build_object(
      'province', trim(p_customer->>'province'),
      'district', trim(p_customer->>'district'),
      'ward', trim(p_customer->>'ward'),
      'streetAddress', trim(p_customer->>'streetAddress')
    ),
    nullif(trim(p_customer->>'note'), ''),
    p_payment_method, 'pending',
    case when p_payment_method = 'bank_transfer' then 'awaiting_payment' else 'pending' end,
    v_subtotal, v_discount, 0, v_total,
    case when v_coupon_code is null then null else jsonb_build_object(
      'code', v_coupon_code, 'type', v_coupon.discount_type,
      'value', v_coupon.discount_value, 'maximum', v_coupon.maximum_discount
    ) end,
    v_transfer_expires_at,
    v_user_id
  ) returning id into v_order_id;

  for v_item in
    select ci.*, v.sku, v.attributes,
      coalesce(v.sale_price, v.regular_price) as current_price,
      p.name as product_name
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    insert into order_items (
      order_id, variant_id, product_name, sku, attributes,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_item.variant_id, v_item.product_name, v_item.sku,
      coalesce(v_item.attributes, '{}'::jsonb), v_item.current_price,
      v_item.quantity, v_item.current_price * v_item.quantity
    );
    insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
    values (v_order_id, v_item.variant_id, v_item.quantity, v_transfer_expires_at);
  end loop;

  if v_coupon_code is not null then
    insert into coupon_redemptions (coupon_id, order_id, expires_at)
    values (v_coupon.id, v_order_id, v_transfer_expires_at);
  end if;

  -- Upsert profile snapshot for signed-in users
  if v_user_id is not null then
    insert into customer_profiles (user_id, full_name, phone, email, address_line, city, district, ward, updated_at)
    values (
      v_user_id,
      trim(p_customer->>'customerName'),
      trim(p_customer->>'customerPhone'),
      nullif(trim(p_customer->>'customerEmail'), ''),
      trim(p_customer->>'streetAddress'),
      trim(p_customer->>'province'),
      trim(p_customer->>'district'),
      trim(p_customer->>'ward'),
      now()
    )
    on conflict (user_id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      email = coalesce(excluded.email, customer_profiles.email),
      address_line = excluded.address_line,
      city = excluded.city,
      district = excluded.district,
      ward = excluded.ward,
      updated_at = now();
  end if;

  update carts set status = 'converted' where id = v_cart.id;

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order_code,
    'totals', jsonb_build_object(
      'subtotal', v_subtotal, 'discountTotal', v_discount,
      'shippingTotal', 0, 'total', v_total
    ),
    'paymentMethod', p_payment_method,
    'orderStatus', case when p_payment_method = 'bank_transfer' then 'awaiting_payment' else 'pending' end,
    'transferExpiresAt', v_transfer_expires_at
  );
exception when others then
  return jsonb_build_object('code', 'INTERNAL_ERROR');
end;
$$;

revoke all on function place_order(text, uuid, text, jsonb, text, text, uuid) from public;
grant execute on function place_order(text, uuid, text, jsonb, text, text, uuid) to anon, authenticated;

-- ─── Customer order list RPC ─────────────────────────────────────────────────

create or replace function customer_list_orders()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderCode', o.order_code,
    'orderStatus', o.order_status,
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'total', o.total,
    'createdAt', o.created_at,
    'itemCount', (select count(*)::int from order_items oi where oi.order_id = o.id)
  ) order by o.created_at desc), '[]'::jsonb)
  into v_rows
  from orders o
  where o.user_id = v_uid
  limit 50;

  return jsonb_build_object('code', 'OK', 'orders', v_rows);
end;
$$;

revoke all on function customer_list_orders() from public;
grant execute on function customer_list_orders() to authenticated;

create or replace function customer_get_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row customer_profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;
  select * into v_row from customer_profiles where user_id = v_uid;
  if not found then
    return jsonb_build_object('code', 'OK', 'profile', null);
  end if;
  return jsonb_build_object(
    'code', 'OK',
    'profile', jsonb_build_object(
      'fullName', v_row.full_name,
      'phone', v_row.phone,
      'email', v_row.email,
      'addressLine', v_row.address_line,
      'city', v_row.city,
      'district', v_row.district,
      'ward', v_row.ward
    )
  );
end;
$$;

create or replace function customer_upsert_profile(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;
  insert into customer_profiles (
    user_id, full_name, phone, email, address_line, city, district, ward, updated_at
  ) values (
    v_uid,
    nullif(trim(p_profile->>'fullName'), ''),
    nullif(trim(p_profile->>'phone'), ''),
    nullif(trim(p_profile->>'email'), ''),
    nullif(trim(p_profile->>'addressLine'), ''),
    nullif(trim(p_profile->>'city'), ''),
    nullif(trim(p_profile->>'district'), ''),
    nullif(trim(p_profile->>'ward'), ''),
    now()
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    address_line = excluded.address_line,
    city = excluded.city,
    district = excluded.district,
    ward = excluded.ward,
    updated_at = now();
  return jsonb_build_object('code', 'OK');
end;
$$;

revoke all on function customer_get_profile() from public;
revoke all on function customer_upsert_profile(jsonb) from public;
grant execute on function customer_get_profile() to authenticated;
grant execute on function customer_upsert_profile(jsonb) to authenticated;

-- ─── Seed reviews / flash / hotspots from existing catalog ───────────────────

insert into product_reviews (product_id, author_name, rating, title, body)
select p.id, r.author_name, r.rating, r.title, r.body
from products p
cross join lateral (
  values
    ('Minh Anh', 5, 'Máy mượt, giao nhanh', 'Dùng ổn cho học và làm việc. Giá rõ, checkout guest tiện.'),
    ('Hoàng Nam', 4, 'Đáng tiền', 'Thông số đúng mô tả. Hỗ trợ chọn máy theo nhu cầu hữu ích.'),
    ('Lan Chi', 5, 'Hài lòng', 'Ảnh thật, tồn kho chính xác. Sẽ mua phụ kiện thêm.')
) as r(author_name, rating, title, body)
where p.is_published and not p.is_archived
  and not exists (select 1 from product_reviews pr where pr.product_id = p.id)
limit 60;

insert into flash_offers (product_id, title, badge, ends_at, is_active, sort_order)
select p.id,
  'Ưu đãi có hạn: ' || p.name,
  'Flash',
  now() + interval '3 days',
  true,
  row_number() over (order by p.created_at desc)
from products p
join product_variants v on v.product_id = p.id and v.is_active and v.sale_price is not null
where p.is_published and not p.is_archived
  and not exists (select 1 from flash_offers f where f.product_id = p.id)
limit 6;

-- Hotspots for top featured published products (up to 2)
insert into product_hotspots (product_id, label, description, x_percent, y_percent, sort_order)
select t.id, h.label, h.description, h.x, h.y, h.ord
from (
  select p.id
  from products p
  where p.is_published and not p.is_archived
    and not exists (select 1 from product_hotspots ph where ph.product_id = p.id)
  order by p.is_featured desc, p.created_at desc
  limit 2
) t
cross join lateral (
  values
    ('Màn hình', 'Độ phân giải cao, phù hợp đa nhiệm và xem phim.', 48.0, 32.0, 1),
    ('Bàn phím', 'Hành trình phím êm, gõ lâu ít mỏi tay.', 52.0, 68.0, 2),
    ('Cổng kết nối', 'USB-C / HDMI đủ dùng học tập và văn phòng.', 18.0, 72.0, 3),
    ('Camera', 'Họp online rõ nét trong điều kiện sáng vừa.', 50.0, 12.0, 4)
) as h(label, description, x, y, ord);
