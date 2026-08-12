-- Enforce Verified Purchase for Reviews
-- A user can only review a product if they have a completed order containing that product.

create or replace function public.check_verified_purchase(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.product_variants pv on pv.id = oi.variant_id
    where o.user_id = auth.uid()
      and pv.product_id = p_product_id
      and o.order_status = 'completed'
  );
$$;

drop policy if exists product_reviews_insert_own on public.product_reviews;

create policy product_reviews_insert_own on public.product_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.check_verified_purchase(product_id)
  );
