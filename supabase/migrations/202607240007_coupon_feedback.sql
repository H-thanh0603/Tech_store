-- Correct expired-coupon marker for seeded inactive coupons. Keep applied
-- migration immutable; this corrective migration runs after cart RPCs.

create or replace function cart_apply_coupon(p_cart_token_hash text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart_id uuid;
  v_coupon coupons%rowtype;
  v_subtotal numeric(12, 2);
  v_used integer;
begin
  select id into v_cart_id from carts where token_hash = p_cart_token_hash and status = 'open' for update;
  if v_cart_id is null then return jsonb_build_object('code', 'CART_NOT_FOUND'); end if;
  select * into v_coupon from coupons where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('code', 'COUPON_INVALID'); end if;
  if v_coupon.ends_at is not null and v_coupon.ends_at <= now() then return jsonb_build_object('code', 'COUPON_EXPIRED'); end if;
  if not v_coupon.is_active then return jsonb_build_object('code', 'COUPON_INVALID'); end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then return jsonb_build_object('code', 'COUPON_INVALID'); end if;
  select count(*) into v_used from coupon_redemptions where coupon_id = v_coupon.id and released_at is null;
  if v_coupon.usage_limit is not null and v_used >= v_coupon.usage_limit then return jsonb_build_object('code', 'COUPON_EXHAUSTED'); end if;
  select coalesce(sum(coalesce(v.sale_price, v.regular_price) * ci.quantity), 0) into v_subtotal
  from cart_items ci join product_variants v on v.id = ci.variant_id where ci.cart_id = v_cart_id;
  if v_subtotal < v_coupon.minimum_order then return jsonb_build_object('code', 'COUPON_MINIMUM'); end if;
  update carts set applied_coupon_id = v_coupon.id where id = v_cart_id;
  return jsonb_build_object('code', 'OK');
end;
$$;

revoke all on function cart_apply_coupon(text, text) from public;
grant execute on function cart_apply_coupon(text, text) to anon, authenticated;
