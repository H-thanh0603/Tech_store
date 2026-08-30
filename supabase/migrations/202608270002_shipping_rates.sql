-- Remove the hardcoded zero constraint on shipping_total
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shipping_total_check;

-- Shipping rate configuration table
CREATE TABLE shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Standard',
  base_rate numeric(12,2) NOT NULL DEFAULT 30000,
  per_item_rate numeric(12,2) NOT NULL DEFAULT 10000,
  free_threshold numeric(12,2) NOT NULL DEFAULT 500000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin can manage, public can read active rates
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active shipping rates"
ON shipping_rates FOR SELECT
USING (is_active = true);

CREATE POLICY "Service role manages shipping rates"
ON shipping_rates FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Seed default shipping rate
INSERT INTO shipping_rates (name, base_rate, per_item_rate, free_threshold)
VALUES ('Phí vận chuyển tiêu chuẩn', 30000, 10000, 500000);

-- RPC to calculate shipping for a cart
CREATE OR REPLACE FUNCTION calculate_shipping(
  p_subtotal numeric,
  p_item_count int
) RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'shippingTotal', CASE
      WHEN sr.free_threshold > 0 AND p_subtotal >= sr.free_threshold THEN 0
      ELSE sr.base_rate + (sr.per_item_rate * GREATEST(p_item_count - 1, 0))
    END,
    'rateName', sr.name,
    'freeThreshold', sr.free_threshold,
    'baseRate', sr.base_rate,
    'perItemRate', sr.per_item_rate,
    'isFree', CASE
      WHEN sr.free_threshold > 0 AND p_subtotal >= sr.free_threshold THEN true
      ELSE false
    END
  )
  FROM shipping_rates sr
  WHERE sr.is_active = true
  ORDER BY sr.created_at ASC
  LIMIT 1;
$$;

-- Apply shipping_total in place_order_internal
CREATE OR REPLACE FUNCTION place_order_internal(
  p_cart_token_hash text,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id uuid;
  v_user_id uuid;
  v_subtotal numeric;
  v_discount numeric;
  v_shipping numeric;
  v_total numeric;
  v_order_id uuid;
  v_order_code text;
  v_items jsonb;
  v_result jsonb;
  v_item_count int;
  v_now timestamptz := now();
BEGIN
  -- Find the cart
  SELECT id INTO v_cart_id
  FROM carts
  WHERE token_hash = p_cart_token_hash
    AND (expires_at IS NULL OR expires_at > v_now);

  IF v_cart_id IS NULL THEN
    RETURN jsonb_build_object('code', 'CART_NOT_FOUND');
  END IF;

  -- Get auth user if available
  v_user_id := auth.uid();

  -- Calculate subtotal from cart items
  SELECT COALESCE(SUM(ci.quantity * ci.price_at_add), 0)
  INTO v_subtotal
  FROM cart_items ci
  WHERE ci.cart_id = v_cart_id;

  -- Count items
  SELECT COALESCE(SUM(ci.quantity), 0)
  INTO v_item_count
  FROM cart_items ci
  WHERE ci.cart_id = v_cart_id;

  -- Calculate coupon discount
  v_discount := 0;
  IF p_coupon_code IS NOT NULL THEN
    SELECT COALESCE(
      CASE
        WHEN c.discount_type = 'percentage' THEN
          LEAST(v_subtotal * c.discount_value / 100, COALESCE(c.maximum_discount, v_subtotal))
        ELSE
          LEAST(c.discount_value, v_subtotal)
      END, 0)
    INTO v_discount
    FROM coupons c
    WHERE c.code = UPPER(p_coupon_code)
      AND c.is_active = true
      AND (c.starts_at IS NULL OR c.starts_at <= v_now)
      AND (c.ends_at IS NULL OR c.ends_at >= v_now)
      AND (c.usage_limit IS NULL OR c.usage_limit > 0);
  END IF;

  -- Calculate shipping
  SELECT (calculate_shipping(v_subtotal, v_item_count)->>'shippingTotal')::numeric
  INTO v_shipping;

  -- Calculate total
  v_total := v_subtotal - v_discount + v_shipping;

  -- Generate order code
  v_order_code := 'ORD-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Create the order
  INSERT INTO orders (
    cart_id, user_id, order_code, access_token_hash,
    customer_name, customer_phone, customer_email,
    province, district, ward, street_address,
    note, payment_method,
    subtotal, discount_total, shipping_total, total,
    status, payment_status,
    created_at, updated_at
  ) VALUES (
    v_cart_id, v_user_id, v_order_code, p_order_access_token_hash,
    p_customer->>'customerName', p_customer->>'customerPhone', p_customer->>'customerEmail',
    p_customer->>'province', p_customer->>'district', p_customer->>'ward', p_customer->>'streetAddress',
    p_customer->>'note', p_payment_method,
    v_subtotal, v_discount, v_shipping, v_total,
    'pending'::order_status, 'pending'::payment_status,
    v_now, v_now
  ) RETURNING id INTO v_order_id;

  -- Create order items
  INSERT INTO order_items (order_id, variant_id, product_name, sku, attributes, unit_price, quantity, line_total)
  SELECT
    v_order_id,
    ci.variant_id,
    p.name,
    pv.sku,
    pv.attributes,
    ci.price_at_add,
    ci.quantity,
    ci.quantity * ci.price_at_add
  FROM cart_items ci
  JOIN product_variants pv ON pv.id = ci.variant_id
  JOIN products p ON p.id = pv.product_id
  WHERE ci.cart_id = v_cart_id;

  -- Build items array for response
  SELECT jsonb_agg(
    jsonb_build_object(
      'productName', oi.product_name,
      'sku', oi.sku,
      'attributes', oi.attributes,
      'unitPrice', oi.unit_price,
      'quantity', oi.quantity,
      'lineTotal', oi.line_total
    )
  )
  INTO v_items
  FROM order_items oi
  WHERE oi.order_id = v_order_id;

  -- Update cart status
  UPDATE carts SET status = 'converted', updated_at = v_now WHERE id = v_cart_id;

  -- Release inventory reservations
  UPDATE inventory_reservations
  SET released_at = v_now
  WHERE cart_id = v_cart_id AND released_at IS NULL;

  -- Build result
  v_result := jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order_code,
    'orderId', v_order_id,
    'totals', jsonb_build_object(
      'subtotal', v_subtotal,
      'discountTotal', v_discount,
      'shippingTotal', v_shipping,
      'total', v_total
    ),
    'items', COALESCE(v_items, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Fix order_get_by_access to read actual shipping_total
CREATE OR REPLACE FUNCTION order_get_by_access(
  p_order_code text,
  p_access_token_hash text
) RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'code', 'OK',
    'orderCode', o.order_code,
    'customerPhone', regexp_replace(o.customer_phone, '\D', '', 'g'),
    'paymentMethod', o.payment_method,
    'paymentStatus', o.payment_status,
    'orderStatus', o.order_status,
    'subtotal', o.subtotal,
    'discountTotal', o.discount_total,
    'shippingTotal', o.shipping_total,
    'total', o.total,
    'transferExpiresAt', o.transfer_expires_at,
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'productName', oi.product_name,
        'sku', oi.sku,
        'attributes', oi.attributes,
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity,
        'lineTotal', oi.line_total
      ))
      FROM order_items oi WHERE oi.order_id = o.id
    )
  )
  FROM orders o
  WHERE o.order_code = p_order_code
    AND o.access_token_hash = p_access_token_hash;
$$;

-- Fix order_track to read actual shipping_total (the 202607240006 body
-- hardcoded shippingTotal to 0). Body matches the original contract:
-- 15-minute buckets on (action_name, identity_hash, bucket_started_at),
-- identical ORDER_NOT_FOUND for wrong code/phone/rate-limit, transfer
-- expiry sweep, access-token rotation, and the same JSON shape the
-- storefront parser expects.
CREATE OR REPLACE FUNCTION order_track(
  p_order_code text,
  p_phone text,
  p_identity_hash text,
  p_new_access_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket timestamptz;
  v_attempts integer;
  v_order orders%rowtype;
  v_items jsonb;
  v_not_found constant jsonb := jsonb_build_object('code', 'ORDER_NOT_FOUND');
BEGIN
  IF p_identity_hash !~ '^[a-f0-9]{64}$' OR p_new_access_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN v_not_found;
  END IF;

  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  INSERT INTO request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  VALUES ('order_track', p_identity_hash, v_bucket, 1)
  ON CONFLICT (action_name, identity_hash, bucket_started_at)
  DO UPDATE SET attempt_count = request_rate_limits.attempt_count + 1
  RETURNING attempt_count INTO v_attempts;
  IF v_attempts > 5 THEN RETURN v_not_found; END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE order_code = upper(trim(p_order_code))
    AND regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  FOR UPDATE;
  IF NOT FOUND THEN RETURN v_not_found; END IF;

  IF v_order.payment_method = 'bank_transfer'
     AND v_order.payment_status = 'pending'
     AND v_order.transfer_expires_at <= now() THEN
    UPDATE orders SET payment_status = 'expired', order_status = 'expired'
    WHERE id = v_order.id
    RETURNING * INTO v_order;
    UPDATE inventory_reservations SET released_at = now()
    WHERE order_id = v_order.id AND released_at IS NULL;
    UPDATE coupon_redemptions SET released_at = now()
    WHERE order_id = v_order.id AND released_at IS NULL;
  END IF;

  UPDATE orders SET access_token_hash = p_new_access_token_hash WHERE id = v_order.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'productName', product_name, 'sku', sku, 'attributes', attributes,
    'unitPrice', unit_price, 'quantity', quantity, 'lineTotal', line_total
  ) order by id), '[]'::jsonb)
  INTO v_items FROM order_items WHERE order_id = v_order.id;

  RETURN jsonb_build_object(
    'code', 'OK', 'orderCode', v_order.order_code,
    'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'orderStatus', v_order.order_status, 'subtotal', v_order.subtotal,
    'discountTotal', v_order.discount_total, 'shippingTotal', v_order.shipping_total,
    'total', v_order.total,
    'transferExpiresAt', v_order.transfer_expires_at, 'items', v_items
  );
END;
$$;
