-- Blueprint §10.2: "Sản phẩm đã xuất hiện trong đơn không được hard delete."
--
-- Enforce this in the database, not just by convention. Deleting a product
-- cascades to its variants; deleting a variant outright nulls order_items FK
-- (snapshot kept) but silences that the SKU was ever sold. Block both so a
-- purchased SKU must be archived instead of destroyed — order history stays
-- audit-traceable.

create or replace function public.chk_block_product_delete() returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from product_variants pv
    where pv.product_id = old.id
      and exists (
        select 1 from order_items oi
        where oi.variant_id = pv.id
      )
  ) then
    raise exception 'Cannot hard-delete product %: it has order_items. Archive instead.', old.id
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger products_block_delete_if_ordered
before delete on public.products
for each row execute function public.chk_block_product_delete();

create function public.chk_block_variant_delete() returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from order_items oi where oi.variant_id = old.id) then
    raise exception 'Cannot hard-delete variant %: it has order_items. Archive instead.', old.id
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger product_variants_block_delete_if_ordered
before delete on public.product_variants
for each row execute function public.chk_block_variant_delete();