-- Minimal policy-presence smoke for the live Supabase project.
-- Read-only assertions: every named RLS policy listed below must still
-- exist on its target table, otherwise a regression on the trust
-- boundary from docs/BAO_CAO_VAN_DE_CAN_XU_LY.md has shipped.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-smoke.sql
-- Non-zero exit if any policy is missing.

\set ON_ERROR_STOP on

do $$
declare
  expected constant text[] := array[
    -- catalog (anon public read)
    'products_read_published',
    'product_variants_read_active',
    'product_specs_read_published',
    'product_use_cases_read_published',
    'product_images_read_published',
    'inventory_read_published',
    'categories_read_active',
    'brands_read_active',
    -- content
    'homepage_collections_public_read',
    'homepage_collection_items_public_read',
    'homepage_sections_public_read',
    'banners_public_read',
    'flash_offers_public_read',
    'product_hotspots_public_read',
    'navigation_items_public_read',
    -- reviews
    'product_reviews_public_read',
    'product_reviews_insert_own',
    -- customer self
    'customer_profiles_select_own',
    'customer_profiles_upsert_own',
    'customer_profiles_update_own',
    'customer_saved_products_select_own',
    -- admin staff
    'admin_users_select_own'
  ];
  missing text[] := array[]::text[];
  p text;
begin
  foreach p in array expected loop
    if not exists (
      select 1 from pg_policies where policyname = p
    ) then
      missing := array_append(missing, p);
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'missing RLS policies: %', array_to_string(missing, ', ');
  end if;
end
$$;
