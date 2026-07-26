-- Dynamic homepage collections (S2 fix).
--
-- The S1A/S2 seeds derived `homepage_collection_items` from the catalog inside a
-- migration, but `supabase/seed.sql` runs *after* migrations: on a fresh database
-- there were no products yet, every collection came out empty, and the query layer
-- correctly dropped the sections that depended on them.
--
-- Rather than fight the ordering, a collection can now describe *what* it wants
-- and let the query layer resolve it at request time:
--
--   manual      → the curated `homepage_collection_items` rows (unchanged)
--   featured    → featured products first, then newest
--   newest      → most recently added products
--   discounted  → products with an active variant priced below its regular price
--
-- Dynamic collections also stay correct over time: a product that sells out of a
-- discount, or a newly published product, is reflected without an editor action.

alter table homepage_collections
  drop constraint if exists homepage_collections_collection_type_check;

alter table homepage_collections
  add constraint homepage_collections_collection_type_check check (
    collection_type in ('manual', 'featured', 'newest', 'discounted')
  );

-- Optional narrowing for dynamic collections, e.g. {"categorySlug":"laptop"}.
-- Validated by Zod in lib/content/collection-filters.ts before it reaches a query.
alter table homepage_collections
  add column if not exists filters jsonb not null default '{}'::jsonb;

alter table homepage_collections
  drop constraint if exists homepage_collections_filters_object;

alter table homepage_collections
  add constraint homepage_collections_filters_object check (
    jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 1024
  );

update homepage_collections
set collection_type = 'featured'
where slug = 'noi-bat';

update homepage_collections
set collection_type = 'discounted'
where slug = 'dang-giam-gia';

update homepage_collections
set collection_type = 'newest'
where slug = 'hang-moi';

update homepage_collections
set collection_type = 'featured',
    filters = '{"categorySlug":"laptop"}'::jsonb
where slug = 'laptop-chon-loc';
