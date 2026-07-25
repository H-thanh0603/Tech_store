-- Storefront content foundation (S1A): editable banners, homepage sections,
-- product collections and navigation. Read-only for the public via RLS; all
-- writes go through the service-role client (see lib/admin/supabase.ts), so no
-- insert/update/delete grant or policy is created for anon/authenticated.

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Display-window predicate shared by RLS policies. ends_at is exclusive so a
-- campaign disappears the instant it expires, matching flash_offers.
create or replace function content_is_visible(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
as $$
  select (p_starts_at is null or p_starts_at <= now())
     and (p_ends_at is null or p_ends_at > now());
$$;

-- Href allow-list enforced in the database so a bad row cannot be stored at
-- all: internal paths must start with a single slash, external links must be
-- https. Mirrored in TypeScript by lib/content/config-schemas.ts (safeHref).
create or replace function content_is_safe_href(p_href text)
returns boolean
language sql
immutable
as $$
  select p_href is not null
     and length(p_href) between 1 and 2048
     and p_href not like '//%'
     and p_href !~ '[[:space:]]'
     and (p_href like '/%' or p_href like 'https://%');
$$;

-- ─── banners ─────────────────────────────────────────────────────────────────

create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slot text not null check (slot in ('home_hero', 'home_promo_grid', 'home_campaign_strip')),
  title text check (title is null or length(trim(title)) between 1 and 160),
  subtitle text check (subtitle is null or length(trim(subtitle)) between 1 and 300),
  image_desktop_url text check (image_desktop_url is null or image_desktop_url like 'https://%'),
  image_mobile_url text check (image_mobile_url is null or image_mobile_url like 'https://%'),
  href text not null check (content_is_safe_href(href)),
  sort_order integer not null default 0 check (sort_order >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banners_window_valid check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- ─── homepage_sections ───────────────────────────────────────────────────────

-- section_type is a CHECK constraint rather than a Postgres enum: adding a
-- section type stays a plain migration and never needs ALTER TYPE.
create table if not exists homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique check (section_key ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  section_type text not null check (
    section_type in (
      'hero',
      'banner_grid',
      'category_mosaic',
      'product_collection',
      'need_selector',
      'brand_strip',
      'editorial',
      'trust',
      'guides',
      'newsletter',
      'flash_sale',
      'recently_viewed'
    )
  ),
  title text check (title is null or length(trim(title)) between 1 and 160),
  subtitle text check (subtitle is null or length(trim(subtitle)) between 1 and 300),
  eyebrow text check (eyebrow is null or length(trim(eyebrow)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  -- Bounded JSON object: per-type shape is validated by Zod on read/write.
  config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(config) = 'object' and pg_column_size(config) <= 4096
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_sections_window_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

-- ─── homepage_collections ────────────────────────────────────────────────────

create table if not exists homepage_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  title text not null check (length(trim(title)) between 1 and 160),
  subtitle text check (subtitle is null or length(trim(subtitle)) between 1 and 300),
  collection_type text not null default 'manual' check (
    collection_type in ('manual', 'featured', 'newest')
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_collections_window_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

-- ─── homepage_collection_items ───────────────────────────────────────────────

create table if not exists homepage_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references homepage_collections (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint homepage_collection_items_unique_product unique (collection_id, product_id)
);

-- ─── navigation_items ────────────────────────────────────────────────────────

-- icon_key stores a lookup key only; the icon component mapping lives in code
-- so the database never dictates what is rendered.
create table if not exists navigation_items (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references navigation_items (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  href text check (href is null or content_is_safe_href(href)),
  item_type text not null default 'link' check (
    item_type in ('link', 'category', 'group', 'promo')
  ),
  icon_key text check (icon_key is null or icon_key ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  image_url text check (image_url is null or image_url like 'https://%'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  open_in_new_tab boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint navigation_items_no_self_parent check (parent_id is null or parent_id <> id),
  constraint navigation_items_href_required check (item_type = 'group' or href is not null),
  constraint navigation_items_new_tab_external_only check (
    not open_in_new_tab or href like 'https://%'
  )
);

-- Walks ancestors to cap the menu at 3 levels and reject parent cycles that a
-- simple CHECK cannot see (A → B → A).
create or replace function navigation_items_enforce_depth()
returns trigger
language plpgsql
as $$
declare
  v_depth int := 1;
  v_parent uuid := new.parent_id;
begin
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'navigation_items: parent cycle detected for %', new.id;
    end if;
    v_depth := v_depth + 1;
    if v_depth > 3 then
      raise exception 'navigation_items: max depth 3 exceeded';
    end if;
    select parent_id into v_parent from navigation_items where id = v_parent;
  end loop;
  return new;
end;
$$;

drop trigger if exists navigation_items_depth_guard on navigation_items;
create trigger navigation_items_depth_guard
before insert or update of parent_id on navigation_items
for each row
execute function navigation_items_enforce_depth();

-- ─── updated_at triggers (set_updated_at from 202607230001_catalog.sql) ──────

drop trigger if exists banners_set_updated_at on banners;
create trigger banners_set_updated_at
before update on banners
for each row
execute function set_updated_at();

drop trigger if exists homepage_sections_set_updated_at on homepage_sections;
create trigger homepage_sections_set_updated_at
before update on homepage_sections
for each row
execute function set_updated_at();

drop trigger if exists homepage_collections_set_updated_at on homepage_collections;
create trigger homepage_collections_set_updated_at
before update on homepage_collections
for each row
execute function set_updated_at();

drop trigger if exists navigation_items_set_updated_at on navigation_items;
create trigger navigation_items_set_updated_at
before update on navigation_items
for each row
execute function set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Partial indexes mirror the RLS predicates so reads never scan hidden rows.
create index if not exists banners_slot_order_idx
  on banners (slot, sort_order, id)
  where is_active;

create index if not exists banners_window_idx
  on banners (starts_at, ends_at)
  where is_active;

create index if not exists homepage_sections_active_order_idx
  on homepage_sections (sort_order, id)
  where is_active;

create index if not exists homepage_collections_active_order_idx
  on homepage_collections (sort_order, id)
  where is_active;

create index if not exists homepage_collection_items_collection_order_idx
  on homepage_collection_items (collection_id, sort_order, id);

create index if not exists homepage_collection_items_product_idx
  on homepage_collection_items (product_id);

create index if not exists navigation_items_active_tree_idx
  on navigation_items (parent_id, sort_order, id)
  where is_active;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table banners enable row level security;
alter table homepage_sections enable row level security;
alter table homepage_collections enable row level security;
alter table homepage_collection_items enable row level security;
alter table navigation_items enable row level security;

-- Local Supabase does not auto-expose new public tables to Data API roles, so
-- the grants must be explicit. SELECT only: writes are service-role.
grant select on
  banners,
  homepage_sections,
  homepage_collections,
  homepage_collection_items,
  navigation_items
to anon, authenticated;

create policy banners_public_read on banners
for select to anon, authenticated
using (is_active = true and content_is_visible(starts_at, ends_at));

create policy homepage_sections_public_read on homepage_sections
for select to anon, authenticated
using (is_active = true and content_is_visible(starts_at, ends_at));

create policy homepage_collections_public_read on homepage_collections
for select to anon, authenticated
using (is_active = true and content_is_visible(starts_at, ends_at));

-- An item is visible only if its collection is visible AND the product is
-- itself publicly visible, so archived/unpublished products cannot leak
-- through a curated collection.
create policy homepage_collection_items_public_read on homepage_collection_items
for select to anon, authenticated
using (
  exists (
    select 1
    from homepage_collections c
    where c.id = homepage_collection_items.collection_id
      and c.is_active = true
      and content_is_visible(c.starts_at, c.ends_at)
  )
  and exists (
    select 1
    from products p
    where p.id = homepage_collection_items.product_id
      and p.is_published = true
      and p.is_archived = false
  )
);

create policy navigation_items_public_read on navigation_items
for select to anon, authenticated
using (is_active = true);
