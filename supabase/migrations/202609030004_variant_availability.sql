-- DB-050: anon/authenticated could SELECT exact inventory.quantity and
-- reserved_quantity (stock espionage). Raw inventory rows are no longer
-- browser-readable; the storefront gets reservation-aware per-variant stock
-- through this definer RPC instead (one indexed call per PDP, no N+1).
--
-- Deploy order: the app code calling this RPC ships first with an embedded-
-- inventory fallback; apply this migration after, then drop the embed in a
-- follow-up. Revoking before the code lands breaks the PDP detail query.

create or replace function product_variant_availability(p_product_id uuid)
returns table (
  variant_id uuid,
  available_stock integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.id, available_variant_stock(v.id)
  from product_variants v
  join products p on p.id = v.product_id
  join categories c on c.id = p.category_id
  where v.product_id = p_product_id
    and v.is_active = true
    and p.is_published = true
    and p.is_archived = false
    and c.is_active = true;
$$;

revoke all on function product_variant_availability(uuid) from public;
grant execute on function product_variant_availability(uuid) to anon, authenticated, service_role;

-- Raw stock internals are no longer browser-readable. Service-role admin
-- paths and definer helpers (available_variant_stock, catalog view) bypass
-- grants via ownership/definer rights and keep working.
revoke all on inventory from public, anon, authenticated;
