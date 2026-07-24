-- Catalog schema: categories, brands, products, variants, images, inventory, specs, use cases.
-- RLS is enabled everywhere; anon/authenticated get read-only access to published/active rows.

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  brand_id uuid references brands (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  is_archived boolean not null default false,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  sku text not null unique,
  attributes jsonb not null default '{}'::jsonb,
  regular_price numeric(12, 2) not null check (regular_price >= 0),
  sale_price numeric(12, 2) check (sale_price is null or (sale_price >= 0 and sale_price <= regular_price)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  variant_id uuid references product_variants (id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique references product_variants (id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity - reserved_quantity >= 0)
);

create table product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  group_name text not null,
  label text not null,
  value text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table product_use_cases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  use_case text not null,
  created_at timestamptz not null default now(),
  unique (product_id, use_case)
);

-- Indexes

create index categories_parent_id_idx on categories (parent_id);
create index categories_is_active_idx on categories (is_active);

create index brands_is_active_idx on brands (is_active);

create index products_category_id_idx on products (category_id);
create index products_brand_id_idx on products (brand_id);
create index products_is_published_idx on products (is_published);
create index products_is_featured_idx on products (is_featured);
create index products_is_archived_idx on products (is_archived);
create index products_search_vector_idx on products using gin (search_vector);

create index product_variants_product_id_idx on product_variants (product_id);
create index product_variants_is_active_idx on product_variants (is_active);
create index product_variants_regular_price_idx on product_variants (regular_price);
create index product_variants_sale_price_idx on product_variants (sale_price);

create index product_images_product_id_idx on product_images (product_id);
create index product_images_variant_id_idx on product_images (variant_id);

create index product_specs_product_id_idx on product_specs (product_id);

create index product_use_cases_product_id_idx on product_use_cases (product_id);
create index product_use_cases_use_case_idx on product_use_cases (use_case);

-- updated_at maintenance

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_set_updated_at
before update on categories
for each row
execute function set_updated_at();

create trigger brands_set_updated_at
before update on brands
for each row
execute function set_updated_at();

create trigger products_set_updated_at
before update on products
for each row
execute function set_updated_at();

create trigger product_variants_set_updated_at
before update on product_variants
for each row
execute function set_updated_at();

create trigger inventory_set_updated_at
before update on inventory
for each row
execute function set_updated_at();

-- Full-text search covers product name, description, and variant SKUs.
-- Maintained via trigger because the SKU list lives on a child table and
-- cannot be expressed as a single-table generated column.

create function refresh_product_search_vector(p_product_id uuid)
returns void
language plpgsql
as $$
begin
  update products
  set search_vector = to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce((
      select string_agg(sku, ' ')
      from product_variants
      where product_id = p_product_id
    ), '')
  )
  where id = p_product_id;
end;
$$;

create function products_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  perform refresh_product_search_vector(new.id);
  return new;
end;
$$;

create trigger products_search_vector_update
after insert or update of name, description on products
for each row
execute function products_search_vector_trigger();

create function product_variants_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_product_search_vector(old.product_id);
  else
    perform refresh_product_search_vector(new.product_id);
  end if;
  return null;
end;
$$;

create trigger product_variants_search_vector_update
after insert or update of sku or delete on product_variants
for each row
execute function product_variants_search_vector_trigger();

-- A product can only be published once it has at least one active variant.
-- Enforced here (not a cross-table check constraint, which Postgres cannot
-- express) so publishing an empty product fails loudly instead of shipping
-- a buyable page with no purchasable variant.

create function enforce_product_publish_requires_variant()
returns trigger
language plpgsql
as $$
begin
  if new.is_published then
    if not exists (
      select 1 from product_variants
      where product_id = new.id and is_active = true
    ) then
      raise exception 'Cannot publish product % without at least one active variant', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger products_publish_requires_variant
before insert or update of is_published on products
for each row
execute function enforce_product_publish_requires_variant();

-- Row level security

alter table categories enable row level security;
alter table brands enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table inventory enable row level security;
alter table product_specs enable row level security;
alter table product_use_cases enable row level security;

-- Local Supabase no longer auto-exposes new public tables to Data API
-- roles, so anon/authenticated need explicit grants before RLS policies
-- have anything to apply to.
grant usage on schema public to anon, authenticated;
grant select on
  categories,
  brands,
  products,
  product_variants,
  product_images,
  inventory,
  product_specs,
  product_use_cases
to anon, authenticated;

create policy categories_read_active on categories
for select to anon, authenticated
using (is_active = true);

create policy brands_read_active on brands
for select to anon, authenticated
using (is_active = true);

create policy products_read_published on products
for select to anon, authenticated
using (is_published = true and is_archived = false);

create policy product_variants_read_active on product_variants
for select to anon, authenticated
using (
  is_active = true
  and exists (
    select 1 from products p
    where p.id = product_variants.product_id
      and p.is_published = true
      and p.is_archived = false
  )
);

create policy product_images_read_published on product_images
for select to anon, authenticated
using (
  exists (
    select 1 from products p
    where p.id = product_images.product_id
      and p.is_published = true
      and p.is_archived = false
  )
);

create policy inventory_read_published on inventory
for select to anon, authenticated
using (
  exists (
    select 1 from product_variants v
    join products p on p.id = v.product_id
    where v.id = inventory.variant_id
      and v.is_active = true
      and p.is_published = true
      and p.is_archived = false
  )
);

create policy product_specs_read_published on product_specs
for select to anon, authenticated
using (
  exists (
    select 1 from products p
    where p.id = product_specs.product_id
      and p.is_published = true
      and p.is_archived = false
  )
);

create policy product_use_cases_read_published on product_use_cases
for select to anon, authenticated
using (
  exists (
    select 1 from products p
    where p.id = product_use_cases.product_id
      and p.is_published = true
      and p.is_archived = false
  )
);
