-- Restore the place_order trust-boundary wrapper (validation, rate limit,
-- pickup handling) that migration 202608250011 unintentionally replaced with
-- the pre-wrapper body from 202607240005. The wrapper delegates to
-- place_order_internal (defined in 202608160001), which is also recreated here
-- with the v_inventory lint fix: the variable was only used to hold a row
-- lock via FOR UPDATE and never read — PERFORM keeps the lock without it.

create or replace function place_order(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfillment text := coalesce(nullif(p_customer->>'fulfillmentMethod', ''), 'delivery');
  v_store_id uuid;
  v_existing orders%rowtype;
  v_result jsonb;
  v_order orders%rowtype;
  v_item record;
  v_store stores%rowtype;
  v_bucket timestamptz;
  v_attempts integer;
  v_name text := trim(coalesce(p_customer->>'customerName', ''));
  v_phone text := trim(coalesce(p_customer->>'customerPhone', ''));
  v_email text := trim(coalesce(p_customer->>'customerEmail', ''));
  v_province text := trim(coalesce(p_customer->>'province', ''));
  v_district text := trim(coalesce(p_customer->>'district', ''));
  v_ward text := trim(coalesce(p_customer->>'ward', ''));
  v_street text := trim(coalesce(p_customer->>'streetAddress', ''));
  v_note text := trim(coalesce(p_customer->>'note', ''));
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$'
     or p_order_access_token_hash !~ '^[a-f0-9]{64}$'
     or p_idempotency_key is null
     or p_payment_method not in ('cod', 'bank_transfer', 'vnpay') then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  select * into v_existing from orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
  end if;

  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('place_order', p_cart_token_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;
  if v_attempts > 5 then
    return jsonb_build_object('code', 'RATE_LIMITED');
  end if;

  if p_customer is null
     or jsonb_typeof(p_customer) <> 'object'
     or char_length(v_name) not between 2 and 120
     or v_phone !~ '^(0|[+]84)(3|5|7|8|9)[0-9]{8}$'
     or char_length(v_email) > 254
     or (v_email <> '' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
     or char_length(v_province) > 100
     or char_length(v_district) > 100
     or char_length(v_ward) > 100
     or char_length(v_street) > 240
     or char_length(v_note) > 500 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  if v_fulfillment not in ('delivery', 'pickup') then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if v_fulfillment = 'delivery' and (
    v_province = '' or v_district = '' or v_ward = '' or char_length(v_street) < 5
  ) then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  if v_fulfillment = 'pickup' then
    if coalesce(p_customer->>'pickupStoreId', '') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('code', 'VALIDATION_ERROR');
    end if;
    v_store_id := (p_customer->>'pickupStoreId')::uuid;

    select * into v_store from stores where id = v_store_id and is_active for share;
    if not found then return jsonb_build_object('code', 'PICKUP_STORE_UNAVAILABLE'); end if;

    for v_item in
      select ci.variant_id, ci.quantity
      from carts c join cart_items ci on ci.cart_id = c.id
      where c.token_hash = p_cart_token_hash and c.status = 'open'
      order by ci.variant_id
    loop
      perform 1 from store_inventory
      where store_id = v_store_id and variant_id = v_item.variant_id
      for update;
      if not found or available_store_stock(v_store_id, v_item.variant_id) < v_item.quantity then
        return jsonb_build_object('code', 'PICKUP_STORE_UNAVAILABLE');
      end if;
    end loop;
  end if;

  v_result := place_order_internal(
    p_cart_token_hash, p_idempotency_key, p_order_access_token_hash,
    p_customer, p_payment_method, p_coupon_code, auth.uid()
  );
  if coalesce(v_result->>'code', '') <> 'OK' then return v_result; end if;

  select * into v_order from orders where order_code = v_result->>'orderCode' for update;
  if v_fulfillment = 'pickup' then
    update orders
    set fulfillment_method = 'pickup', pickup_store_id = v_store_id,
        address_snapshot = jsonb_build_object(
          'province', v_store.province,
          'district', v_store.district,
          'ward', '',
          'streetAddress', v_store.street_address
        )
    where id = v_order.id;

    insert into store_inventory_reservations (
      order_id, store_id, variant_id, quantity, expires_at
    )
    select v_order.id, v_store_id, ci.variant_id, ci.quantity, v_order.transfer_expires_at
    from cart_items ci where ci.cart_id = v_order.cart_id;
  end if;

  return v_result || jsonb_build_object(
    'fulfillmentMethod', v_fulfillment,
    'pickupStore', case when v_fulfillment = 'pickup' then jsonb_build_object(
      'id', v_store.id, 'name', v_store.name, 'address', v_store.street_address,
      'district', v_store.district, 'province', v_store.province,
      'openingHours', v_store.opening_hours
    ) else null end
  );
exception when others then
  return jsonb_build_object('code', 'INTERNAL_ERROR');
end;
$$;

revoke all on function place_order(text, uuid, text, jsonb, text, text) from public;
grant execute on function place_order(text, uuid, text, jsonb, text, text) to anon, authenticated;

-- ─── place_order_internal with the v_inventory lint fix ─────────────────────

create or replace function place_order_internal(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart carts%rowtype;
  v_existing orders%rowtype;
  v_coupon coupons%rowtype;
  v_order_id uuid;
  v_order_code text;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_transfer_expires_at timestamptz;
  v_available integer;
  v_coupon_code text;
  v_item record;
  v_user_id uuid;
  v_holds_stock boolean;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$'
     or p_order_access_token_hash !~ '^[a-f0-9]{64}$'
     or p_idempotency_key is null
     or p_payment_method not in ('cod', 'bank_transfer', 'vnpay') then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  -- Prefer JWT user; reject spoofed p_user_id when session present.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif p_user_id is not null and p_user_id <> v_user_id then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  -- Bank transfer and VNPay both hold stock until the gateway confirms; COD
  -- keeps an open reservation that releases when the order is fulfilled.
  v_holds_stock := p_payment_method in ('bank_transfer', 'vnpay');

  select * into v_existing
  from orders
  where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
  end if;

  select * into v_cart
  from carts
  where token_hash = p_cart_token_hash
  for update;
  if not found or v_cart.status <> 'open' then
    if found then
      select * into v_existing from orders where cart_id = v_cart.id order by created_at desc limit 1;
      if found then
        return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
      end if;
    end if;
    return jsonb_build_object('code', 'CART_EMPTY');
  end if;

  if not exists (select 1 from cart_items where cart_id = v_cart.id) then
    return jsonb_build_object('code', 'CART_EMPTY');
  end if;

  -- Lock every inventory row in deterministic variant order before checking
  -- availability. This prevents two concurrent checkouts overselling stock.
  -- ponytail: PERFORM holds the row lock without an unused variable (lint fix).
  for v_item in
    select ci.variant_id
    from cart_items ci
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    perform 1
    from inventory
    where variant_id = v_item.variant_id
    for update;
    if not found then
      return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', 0);
    end if;
  end loop;

  for v_item in
    select ci.*, v.product_id, v.sku, v.attributes,
      coalesce(v.sale_price, v.regular_price) as current_price,
      p.name as product_name, p.is_published, p.is_archived, v.is_active
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    if not v_item.is_active or not v_item.is_published or v_item.is_archived then
      return jsonb_build_object('code', 'PRODUCT_UNAVAILABLE');
    end if;

    v_available := available_variant_stock(v_item.variant_id);
    if v_available < v_item.quantity then
      return jsonb_build_object('code', 'OUT_OF_STOCK', 'available', v_available);
    end if;

    if v_item.price_at_add <> v_item.current_price then
      return jsonb_build_object('code', 'PRICE_CHANGED');
    end if;

    v_subtotal := v_subtotal + v_item.current_price * v_item.quantity;
  end loop;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon
    from coupons
    where code = upper(trim(p_coupon_code))
    for update;
    if not found or not v_coupon.is_active then
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at <= now() then
      return jsonb_build_object('code', 'COUPON_EXPIRED');
    end if;
    if v_coupon.usage_limit is not null and
       (select count(*) from coupon_redemptions
        where coupon_id = v_coupon.id and released_at is null) >= v_coupon.usage_limit then
      return jsonb_build_object('code', 'COUPON_EXHAUSTED');
    end if;
    if v_subtotal < v_coupon.minimum_order then
      return jsonb_build_object('code', 'COUPON_MINIMUM');
    end if;
    v_discount := least(
      case when v_coupon.discount_type = 'percentage'
        then floor(v_subtotal * v_coupon.discount_value / 100)
        else v_coupon.discount_value end,
      coalesce(v_coupon.maximum_discount, v_subtotal),
      v_subtotal
    );
    v_coupon_code := v_coupon.code;
  elsif v_cart.applied_coupon_id is not null then
    select * into v_coupon from coupons where id = v_cart.applied_coupon_id for update;
    if found and v_coupon.is_active
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.ends_at is null or v_coupon.ends_at > now())
       and (v_coupon.usage_limit is null or
         (select count(*) from coupon_redemptions
          where coupon_id = v_coupon.id and released_at is null) < v_coupon.usage_limit)
       and v_subtotal >= v_coupon.minimum_order then
      v_discount := least(
        case when v_coupon.discount_type = 'percentage'
          then floor(v_subtotal * v_coupon.discount_value / 100)
          else v_coupon.discount_value end,
        coalesce(v_coupon.maximum_discount, v_subtotal),
        v_subtotal
      );
      v_coupon_code := v_coupon.code;
    else
      return jsonb_build_object('code', 'COUPON_INVALID');
    end if;
  end if;

  v_total := v_subtotal - v_discount;
  if v_holds_stock then
    v_transfer_expires_at := now() + interval '24 hours';
  end if;
  v_order_code := 'TS-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('commerce_order_code_seq')::text, 6, '0');

  insert into orders (
    order_code, cart_id, idempotency_key, access_token_hash,
    customer_name, customer_phone, customer_email, address_snapshot, note,
    payment_method, payment_status, order_status,
    subtotal, discount_total, shipping_total, total, coupon_snapshot,
    transfer_expires_at, user_id
  ) values (
    v_order_code, v_cart.id, p_idempotency_key, p_order_access_token_hash,
    trim(p_customer->>'customerName'), trim(p_customer->>'customerPhone'),
    nullif(trim(p_customer->>'customerEmail'), ''),
    jsonb_build_object(
      'province', trim(p_customer->>'province'),
      'district', trim(p_customer->>'district'),
      'ward', trim(p_customer->>'ward'),
      'streetAddress', trim(p_customer->>'streetAddress')
    ),
    nullif(trim(p_customer->>'note'), ''),
    p_payment_method, 'pending',
    case when v_holds_stock then 'awaiting_payment' else 'pending' end,
    v_subtotal, v_discount, 0, v_total,
    case when v_coupon_code is null then null else jsonb_build_object(
      'code', v_coupon_code, 'type', v_coupon.discount_type,
      'value', v_coupon.discount_value, 'maximum', v_coupon.maximum_discount
    ) end,
    v_transfer_expires_at,
    v_user_id
  ) returning id into v_order_id;

  for v_item in
    select ci.*, v.sku, v.attributes,
      coalesce(v.sale_price, v.regular_price) as current_price,
      p.name as product_name
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    insert into order_items (
      order_id, variant_id, product_name, sku, attributes,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_item.variant_id, v_item.product_name, v_item.sku,
      coalesce(v_item.attributes, '{}'::jsonb), v_item.current_price,
      v_item.quantity, v_item.current_price * v_item.quantity
    );
    insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
    values (v_order_id, v_item.variant_id, v_item.quantity, v_transfer_expires_at);
  end loop;

  if v_coupon_code is not null then
    insert into coupon_redemptions (coupon_id, order_id, expires_at)
    values (v_coupon.id, v_order_id, v_transfer_expires_at);
  end if;

  update carts set status = 'converted' where id = v_cart.id;

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order_code,
    'totals', jsonb_build_object(
      'subtotal', v_subtotal, 'discountTotal', v_discount,
      'shippingTotal', 0, 'total', v_total
    ),
    'paymentMethod', p_payment_method,
    'orderStatus', case when v_holds_stock then 'awaiting_payment' else 'pending' end,
    'transferExpiresAt', v_transfer_expires_at
  );
exception when others then
  return jsonb_build_object('code', 'INTERNAL_ERROR');
end;
$$;

revoke all on function place_order_internal(text, uuid, text, jsonb, text, text, uuid) from public;
