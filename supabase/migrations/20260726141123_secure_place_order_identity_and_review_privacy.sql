-- Security hardening: remove the public user-id override from checkout and
-- expose only the safe review columns through the Data API.

-- Keep the existing implementation as an owner-only internal helper. The
-- public wrapper below supplies auth.uid() and never accepts a caller-owned
-- user id.
alter function public.place_order(text, uuid, text, jsonb, text, text, uuid)
  rename to place_order_internal;

revoke all on function public.place_order_internal(text, uuid, text, jsonb, text, text, uuid)
  from public, anon, authenticated;

create function public.place_order(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.place_order_internal(
    p_cart_token_hash,
    p_idempotency_key,
    p_order_access_token_hash,
    p_customer,
    p_payment_method,
    p_coupon_code,
    auth.uid()
  );
$$;

revoke all on function public.place_order(text, uuid, text, jsonb, text, text)
  from public;
grant execute on function public.place_order(text, uuid, text, jsonb, text, text)
  to anon, authenticated;

drop view if exists public.public_product_reviews;
create view public.public_product_reviews
  with (security_invoker = true)
as
  select id, product_id, author_name, rating, title, body, is_published, created_at
  from public.product_reviews
  where is_published = true;

-- Column-level grants prevent both the base table and the view from exposing
-- the internal auth.users foreign key through PostgREST.
revoke all on table public.product_reviews from anon, authenticated;
grant select (
  id, product_id, author_name, rating, title, body, is_published, created_at
) on table public.product_reviews to anon, authenticated;
grant select on table public.product_reviews to service_role;

revoke all on public.public_product_reviews from public;
grant select on public.public_product_reviews to anon, authenticated;
