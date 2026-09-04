-- Missing SELECT grants: flash_offers and product_hotspots both have public-read
-- RLS policies but no grants for anon/authenticated, so every storefront read
-- failed with 42501 and the callers fail-opened to empty (flash sales and PDP
-- hotspots never rendered). Same bug class as the P0-1 shipping_rates grant.

grant select on flash_offers to anon, authenticated;
grant select on product_hotspots to anon, authenticated;
