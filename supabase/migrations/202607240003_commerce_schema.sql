-- Commerce schema for guest cart, coupons, orders, and stock reservations.
-- Write access is via SECURITY DEFINER RPCs only (added in later migrations);
-- anon/authenticated never receive table write grants. Raw cart/order tokens
-- live only in httpOnly cookies; PostgreSQL only ever sees their SHA-256 hash
-- (64 hex chars, enforced by check constraints).

-- Carts: one open cart per hashed cookie token.

create table carts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  status text not null default 'open' check (status in ('open', 'converted', 'expired')),
  applied_coupon_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts (id) on delete cascade,
  variant_id uuid not null references product_variants (id),
  quantity integer not null check (quantity between 1 and 99),
  price_at_add numeric(12, 2) not null check (price_at_add >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code))),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  minimum_order numeric(12, 2) not null default 0 check (minimum_order >= 0),
  maximum_discount numeric(12, 2) check (maximum_discount is null or maximum_discount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Cart's applied coupon references coupons; added after coupons exists.
alter table carts
  add constraint carts_applied_coupon_id_fkey
  foreign key (applied_coupon_id) references coupons (id) on delete set null;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  cart_id uuid references carts (id),
  idempotency_key uuid not null unique,
  access_token_hash text not null unique check (length(access_token_hash) = 64),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address_snapshot jsonb not null,
  note text,
  payment_method text not null check (payment_method in ('cod', 'bank_transfer')),
  payment_status text not null check (payment_status in ('pending', 'paid', 'failed', 'expired')),
  order_status text not null check (
    order_status in (
      'pending', 'awaiting_payment', 'confirmed', 'packing',
      'shipping', 'completed', 'cancelled', 'expired'
    )
  ),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  shipping_total numeric(12, 2) not null default 0 check (shipping_total = 0),
  total numeric(12, 2) not null check (total >= 0),
  coupon_snapshot jsonb,
  transfer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal - discount_total + shipping_total),
  check (payment_method <> 'bank_transfer' or transfer_expires_at is not null)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete restrict,
  variant_id uuid references product_variants (id) on delete set null,
  product_name text not null,
  sku text not null,
  attributes jsonb not null default '{}'::jsonb,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total numeric(12, 2) not null check (line_total = unit_price * quantity)
);

create table inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete restrict,
  variant_id uuid not null references product_variants (id),
  quantity integer not null check (quantity > 0),
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons (id),
  order_id uuid not null unique references orders (id) on delete restrict,
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table request_rate_limits (
  id uuid primary key default gen_random_uuid(),
  action_name text not null,
  identity_hash text not null check (length(identity_hash) = 64),
  bucket_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  unique (action_name, identity_hash, bucket_started_at)
);

-- Indexes

create index carts_token_hash_idx on carts (token_hash);
create index carts_status_idx on carts (status);
create index cart_items_cart_id_idx on cart_items (cart_id);
create index cart_items_variant_id_idx on cart_items (variant_id);

create index coupons_code_idx on coupons (code);
create index coupons_active_idx on coupons (is_active, starts_at, ends_at);

create index orders_order_code_idx on orders (order_code);
create index orders_order_status_idx on orders (order_status);
create index orders_idempotency_key_idx on orders (idempotency_key);
create index orders_transfer_expires_at_idx on orders (transfer_expires_at);

create index order_items_order_id_idx on order_items (order_id);

create index inventory_reservations_variant_id_idx on inventory_reservations (variant_id);
create index inventory_reservations_active_idx
  on inventory_reservations (variant_id, expires_at)
  where released_at is null;
create index inventory_reservations_order_id_idx on inventory_reservations (order_id);

create index coupon_redemptions_coupon_id_idx on coupon_redemptions (coupon_id);

create index request_rate_limits_bucket_idx
  on request_rate_limits (action_name, identity_hash, bucket_started_at);

-- updated_at maintenance (reuses set_updated_at() from the catalog migration)

create trigger carts_set_updated_at
before update on carts
for each row
execute function set_updated_at();

create trigger cart_items_set_updated_at
before update on cart_items
for each row
execute function set_updated_at();

create trigger orders_set_updated_at
before update on orders
for each row
execute function set_updated_at();

-- Row level security: enable everywhere; grant no table writes to browser
-- roles. RPCs (SECURITY DEFINER, added later) are the only write path.

alter table carts enable row level security;
alter table cart_items enable row level security;
alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_reservations enable row level security;
alter table request_rate_limits enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated: with RLS on
-- and no policy, direct table access is denied. All reads/writes flow through
-- SECURITY DEFINER RPCs that bypass RLS as the function owner.

revoke all on
  carts, cart_items, coupons, coupon_redemptions, orders,
  order_items, inventory_reservations, request_rate_limits
from anon, authenticated;

-- Active-reservation-aware available stock. Used by cart/order RPCs and the
-- catalog view so a variant reserved by a pending order is not oversold.
-- security invoker: the RPCs that need to bypass RLS are SECURITY DEFINER and
-- call this within their own owner context.

create function available_variant_stock(p_variant_id uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(
    inv.quantity - inv.reserved_quantity - coalesce((
      select sum(ir.quantity)
      from inventory_reservations ir
      join orders o on o.id = ir.order_id
      where ir.variant_id = p_variant_id
        and ir.released_at is null
        and (ir.expires_at is null or ir.expires_at > now())
        and o.order_status not in ('cancelled', 'expired')
    ), 0),
    0
  )::integer
  from inventory inv
  where inv.variant_id = p_variant_id;
$$;

-- Replace the catalog view so storefront available_stock accounts for active
-- reservations. Columns are unchanged; only the available_stock expression now
-- routes through available_variant_stock(v.id).

drop view if exists catalog_products;

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
    select coalesce(sum(available_variant_stock(v.id)), 0)
    from product_variants v
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
