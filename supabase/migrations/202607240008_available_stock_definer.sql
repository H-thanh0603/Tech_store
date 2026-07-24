-- catalog_products.available_stock calls available_variant_stock() under
-- security_invoker. The helper must be SECURITY DEFINER so anonymous catalog
-- reads can account for active reservations without granting direct SELECT on
-- inventory_reservations / orders to the browser role.

create or replace function available_variant_stock(p_variant_id uuid)
returns integer
language sql
stable
security definer
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

revoke all on function available_variant_stock(uuid) from public;
grant execute on function available_variant_stock(uuid) to anon, authenticated;
