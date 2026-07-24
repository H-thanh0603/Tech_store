-- Guest cart RPCs. Browser roles only receive these explicit function grants;
-- raw cookie tokens are SHA-256 hashes before reaching PostgreSQL.

create function cart_get(p_cart_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart carts%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_coupon_code text;
begin
  select * into v_cart
  from carts
  where token_hash = p_cart_token_hash and status = 'open';

  if not found then
    return jsonb_build_object(
      'items', v_items, 'itemCount', 0, 'subtotal', 0, 'discountTotal', 0,
      'shippingTotal', 0, 'total', 0, 'appliedCouponCode', null, 'canCheckout', false
    );
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', row.id,
      'variantId', row.variant_id,
      'productName', row.product_name,
      'productSlug', row.product_slug,
      'sku', row.sku,
      'attributes', row.attributes,
      'quantity', row.quantity,
      'priceAtAdd', row.price_at_add,
      'currentPrice', row.current_price,
      'lineTotal', row.current_price * row.quantity,
      'availableStock', row.available_stock,
      'priceChanged', row.price_at_add <> row.current_price,
      'outOfStock', row.available_stock < row.quantity,
      'imageUrl', row.image_url,
      'imageAlt', row.image_alt
    ) order by row.created_at), '[]'::jsonb),
    coalesce(sum(row.current_price * row.quantity), 0)
  into v_items, v_subtotal
  from (
    select ci.*, p.name as product_name, p.slug as product_slug, v.sku, v.attributes,
      coalesce(v.sale_price, v.regular_price) as current_price,
      available_variant_stock(v.id) as available_stock,
      (
        select pi.url from product_images pi
        where pi.product_id = p.id and (pi.variant_id = v.id or pi.variant_id is null)
        order by (pi.variant_id is null), pi.sort_order, pi.id limit 1
      ) as image_url,
      (
        select pi.alt_text from product_images pi
        where pi.product_id = p.id and (pi.variant_id = v.id or pi.variant_id is null)
        order by (pi.variant_id is null), pi.sort_order, pi.id limit 1
      ) as image_alt
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = v_cart.id
  ) row;

  select c.code into v_coupon_code
  from coupons c where c.id = v_cart.applied_coupon_id;

  if v_coupon_code is not null then
    select least(
      case when c.discount_type = 'percentage'
        then floor(v_subtotal * c.discount_value / 100)
        else c.discount_value end,
      coalesce(c.maximum_discount, v_subtotal),
      v_subtotal
    ) into v_discount
    from coupons c
    where c.id = v_cart.applied_coupon_id;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'itemCount', coalesce((select sum(quantity) from cart_items where cart_id = v_cart.id), 0),
    'subtotal', v_subtotal,
    'discountTotal', v_discount,
    'shippingTotal', 0,
    'total', v_subtotal - v_discount,
    'appliedCouponCode', v_coupon_code,
    'canCheckout', jsonb_array_length(v_items) > 0
      and not exists (
        select 1 from jsonb_array_elements(v_items) item
        where (item->>'priceChanged')::boolean or (item->>'outOfStock')::boolean
      )
  );
end;
$$;

create function cart_add_item(p_cart_token_hash text, p_variant_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart_id uuid;
  v_price numeric(12, 2);
  v_available integer;
  v_requested integer;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$' or p_quantity not between 1 and 99 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  insert into carts (token_hash) values (p_cart_token_hash)
  on conflict (token_hash) do nothing;

  select id into v_cart_id from carts
  where token_hash = p_cart_token_hash and status = 'open'
  for update;
  if v_cart_id is null then
    return jsonb_build_object('code', 'CART_NOT_FOUND');
  end if;

  select coalesce(v.sale_price, v.regular_price) into v_price
  from product_variants v
  join products p on p.id = v.product_id
  where v.id = p_variant_id and v.is_active and p.is_published and not p.is_archived;
  if v_price is null then
    return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE');
  end if;

  perform 1 from inventory where variant_id = p_variant_id for update;
  if not found then
    return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE');
  end if;
  v_available := available_variant_stock(p_variant_id);
  select coalesce((
    select quantity from cart_items where cart_id = v_cart_id and variant_id = p_variant_id
  ), 0) + p_quantity into v_requested;
  if v_requested > v_available then
    return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', v_available);
  end if;

  insert into cart_items (cart_id, variant_id, quantity, price_at_add)
  values (v_cart_id, p_variant_id, p_quantity, v_price)
  on conflict (cart_id, variant_id) do update
  set quantity = cart_items.quantity + excluded.quantity;

  return jsonb_build_object('code', 'OK');
end;
$$;

create function cart_update_item(p_cart_token_hash text, p_item_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart_id uuid;
  v_variant_id uuid;
  v_available integer;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$' or p_quantity not between 1 and 99 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  select id into v_cart_id from carts where token_hash = p_cart_token_hash and status = 'open' for update;
  if v_cart_id is null then return jsonb_build_object('code', 'CART_NOT_FOUND'); end if;
  select ci.variant_id into v_variant_id
  from cart_items ci
  join product_variants v on v.id = ci.variant_id
  join products p on p.id = v.product_id
  where ci.id = p_item_id and ci.cart_id = v_cart_id
    and v.is_active and p.is_published and not p.is_archived;
  if v_variant_id is null then return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE'); end if;
  perform 1 from inventory where variant_id = v_variant_id for update;
  if not found then return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE'); end if;
  v_available := available_variant_stock(v_variant_id);
  if p_quantity > v_available then return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', v_available); end if;
  update cart_items set quantity = p_quantity where id = p_item_id and cart_id = v_cart_id;
  return jsonb_build_object('code', 'OK');
end;
$$;

create function cart_remove_item(p_cart_token_hash text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_cart_id uuid;
begin
  select id into v_cart_id from carts where token_hash = p_cart_token_hash and status = 'open' for update;
  if v_cart_id is null then return jsonb_build_object('code', 'CART_NOT_FOUND'); end if;
  delete from cart_items where id = p_item_id and cart_id = v_cart_id;
  return jsonb_build_object('code', 'OK');
end;
$$;

create function cart_apply_coupon(p_cart_token_hash text, p_code text)
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
  if not found or not v_coupon.is_active then return jsonb_build_object('code', 'COUPON_INVALID'); end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then return jsonb_build_object('code', 'COUPON_INVALID'); end if;
  if v_coupon.ends_at is not null and v_coupon.ends_at <= now() then return jsonb_build_object('code', 'COUPON_EXPIRED'); end if;
  select count(*) into v_used from coupon_redemptions where coupon_id = v_coupon.id and released_at is null;
  if v_coupon.usage_limit is not null and v_used >= v_coupon.usage_limit then return jsonb_build_object('code', 'COUPON_EXHAUSTED'); end if;
  select coalesce(sum(coalesce(v.sale_price, v.regular_price) * ci.quantity), 0) into v_subtotal
  from cart_items ci join product_variants v on v.id = ci.variant_id where ci.cart_id = v_cart_id;
  if v_subtotal < v_coupon.minimum_order then return jsonb_build_object('code', 'COUPON_MINIMUM'); end if;
  update carts set applied_coupon_id = v_coupon.id where id = v_cart_id;
  return jsonb_build_object('code', 'OK');
end;
$$;

revoke all on function cart_get(text), cart_add_item(text, uuid, integer),
  cart_update_item(text, uuid, integer), cart_remove_item(text, uuid),
  cart_apply_coupon(text, text) from public;
grant execute on function cart_get(text), cart_add_item(text, uuid, integer),
  cart_update_item(text, uuid, integer), cart_remove_item(text, uuid),
  cart_apply_coupon(text, text) to anon, authenticated;
