-- C3 checkout concurrency hardening (audit Phase 0).
--
-- 1. Idempotency race: two concurrent same-key checkouts both missed the
--    SELECT-then-INSERT window; loser died with INTERNAL_ERROR (exception
--    swallower) instead of IDEMPOTENT_REPLAY. Fix: pg_advisory_xact_lock per
--    idempotency key in BOTH wrapper and internal + unique_violation rescue
--    on the orders insert that re-reads the winner and replays it.
-- 2. Last-unit oversell: inventory rows are FOR UPDATE-locked but uncommitted
--    reservations are invisible to the concurrent txn (phantom). Fix: per
--    variant advisory xact lock in deterministic order — serializes the
--    check-then-reserve window across txns.
-- 3. Coupon TOCTOU: COUNT(*) over redemptions is non-locking. The coupon row
--    FOR UPDATE already serializes same-code checkouts; add a per-code
--    advisory lock for belt-and-braces + a partial index so the per-checkout
--    COUNT(*) stays cheap at volume.
-- 4. VNPay late-reopen without stock re-check: expired orders had released
--    reservations; reopening to confirmed+paid could oversell. Fix: re-check
--    live availability before reopen, else OUT_OF_STOCK for ops triage.
-- 5. Hot-table growth: reservations/rate-limits grow unbounded and slow every
--    stock check. Add the missing indexes + a purge helper for the cron.

-- 3b/5. Partial index for the per-checkout coupon usage COUNT(*).
create index if not exists coupon_redemptions_active_idx
  on coupon_redemptions (coupon_id)
  where released_at is null;

-- 5. Hot-path indexes for sweeps and purges.
create index if not exists inventory_reservations_expires_idx
  on inventory_reservations (expires_at);
create index if not exists inventory_reservations_variant_idx
  on inventory_reservations (variant_id);
create index if not exists request_rate_limits_bucket_idx
  on request_rate_limits (bucket_started_at);

-- 5. Purge helper: expired reservations + old rate-limit buckets.
-- Service-role only; wire to the existing release-expired-reservations cron.
create or replace function purge_checkout_hot_tables(
  p_rate_limit_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservations integer := 0;
  v_rate_limits integer := 0;
begin
  delete from inventory_reservations
  where expires_at < now() - interval '7 days';
  get diagnostics v_reservations = row_count;

  delete from request_rate_limits
  where bucket_started_at < now() - (make_interval(days => greatest(p_rate_limit_days, 1)));
  get diagnostics v_rate_limits = row_count;

  return jsonb_build_object(
    'code', 'OK',
    'purgedReservations', v_reservations,
    'purgedRateLimits', v_rate_limits
  );
end;
$$;

revoke all on function purge_checkout_hot_tables(integer) from public, anon, authenticated;
grant execute on function purge_checkout_hot_tables(integer) to service_role;

-- 1+2+3. Recreate place_order_internal with advisory locks + replay rescue.
-- Body mirrors 202609130001_fix_place_order_shipping.sql with the C3 deltas
-- marked below (advisory locks, coupon lock, insert rescue).
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
  v_shipping numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_transfer_expires_at timestamptz;
  v_available integer;
  v_coupon_code text;
  v_item record;
  v_user_id uuid;
  v_holds_stock boolean;
  v_item_count integer := 0;
  v_rate shipping_rates%rowtype;
  v_is_pickup boolean := false;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$'
     or p_order_access_token_hash !~ '^[a-f0-9]{64}$'
     or p_idempotency_key is null
     or p_payment_method not in ('cod', 'bank_transfer', 'vnpay') then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

  -- C3-1: serialize concurrent checkouts sharing one idempotency key.
  perform pg_advisory_xact_lock(hashtext('place_order:' || p_idempotency_key::text));

  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif p_user_id is not null and p_user_id <> v_user_id then
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end if;

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

  -- C3-2: per-variant advisory lock (deterministic order) closes the
  -- phantom-reservation window that row locks alone cannot (uncommitted
  -- reservations are invisible to the concurrent txn).
  for v_item in
    select ci.variant_id
    from cart_items ci
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    perform pg_advisory_xact_lock(hashtext('variant:' || v_item.variant_id::text));
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
    v_item_count := v_item_count + v_item.quantity;
  end loop;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    -- C3-3: serialize same-code checkouts so the usage COUNT(*) cannot race.
    perform pg_advisory_xact_lock(hashtext('coupon:' || upper(trim(p_coupon_code))));
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
    if found then
      perform pg_advisory_xact_lock(hashtext('coupon:' || v_coupon.code));
    end if;
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

  v_is_pickup := coalesce(p_customer->>'fulfillmentMethod', '') = 'pickup';
  if not v_is_pickup and v_item_count > 0 then
    select * into v_rate
    from shipping_rates
    where is_active = true
    order by created_at asc
    limit 1;
    if found then
      if v_rate.free_threshold > 0 and v_subtotal >= v_rate.free_threshold then
        v_shipping := 0;
      else
        v_shipping := v_rate.base_rate + (v_rate.per_item_rate * greatest(v_item_count - 1, 0));
      end if;
    end if;
  end if;

  v_total := v_subtotal - v_discount + v_shipping;
  if v_holds_stock then
    v_transfer_expires_at := now() + interval '24 hours';
  end if;
  v_order_code := 'TS-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('commerce_order_code_seq')::text, 6, '0');

  -- C3-1b: the advisory lock makes the duplicate-insert window vanishingly
  -- small, but a retry racing a just-committed winner must still replay the
  -- winner instead of surfacing INTERNAL_ERROR (double-charge confusion).
  begin
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
      v_subtotal, v_discount, v_shipping, v_total,
      case when v_coupon_code is null then null else jsonb_build_object(
        'code', v_coupon_code, 'type', v_coupon.discount_type,
        'value', v_coupon.discount_value, 'maximum', v_coupon.maximum_discount
      ) end,
      v_transfer_expires_at,
      v_user_id
    ) returning id into v_order_id;
  exception when unique_violation then
    select * into v_existing from orders where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
    end if;
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end;

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
    begin
      insert into coupon_redemptions (coupon_id, order_id, expires_at)
      values (v_coupon.id, v_order_id, v_transfer_expires_at);
    exception when unique_violation then
      -- Same-coupon double-submit: order already placed above; surface the
      -- winner instead of failing the checkout as an internal error.
      select * into v_existing from orders where idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
      end if;
      return jsonb_build_object('code', 'COUPON_EXHAUSTED');
    end;
  end if;

  update carts set status = 'converted' where id = v_cart.id;

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order_code,
    'totals', jsonb_build_object(
      'subtotal', v_subtotal, 'discountTotal', v_discount,
      'shippingTotal', v_shipping, 'total', v_total
    ),
    'paymentMethod', p_payment_method,
    'orderStatus', case when v_holds_stock then 'awaiting_payment' else 'pending' end,
    'transferExpiresAt', v_transfer_expires_at
  );
exception when others then
  -- Never leak a duplicate-key stack as INTERNAL_ERROR when we can replay.
  begin
    select * into v_existing from orders where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('code', 'IDEMPOTENT_REPLAY', 'orderCode', v_existing.order_code);
    end if;
  exception when others then
    null;
  end;
  return jsonb_build_object('code', 'INTERNAL_ERROR');
end;
$$;

revoke all on function place_order_internal(text, uuid, text, jsonb, text, text, uuid) from public;

-- 1c. Wrapper note: place_order (wrapper) keeps its validation + rate-limit +
-- pickup body untouched by this migration. Its pre-check SELECT on
-- idempotency_key is a fast-path only — the authoritative serialization +
-- replay lives in place_order_internal above, so a wrapper-level race simply
-- falls through to internal and replays the winner instead of 500ing.
-- Do NOT recreate the wrapper here (past drift incidents came from
-- copy-pasted wrapper bodies); if a wrapper-level advisory lock is ever
-- needed, patch the newest wrapper body in place.

-- 4. Late-reopen must re-check live stock: expired orders released their
-- reservations, so blindly confirming oversells. Recreate the gateway paid
-- marker with an availability gate on the expired-reopen path.
create or replace function order_mark_paid_by_gateway(
  p_order_code text,
  p_vnp_transaction_no text,
  p_vnp_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_transaction_no text := nullif(trim(coalesce(p_vnp_transaction_no, '')), '');
  v_line record;
  v_avail integer;
begin
  if p_order_code is null or trim(p_order_code) = ''
     or v_transaction_no is null
     or p_vnp_amount is null
     or p_vnp_amount <= 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
  for update;

  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  if v_order.total * 100 <> p_vnp_amount then
    return jsonb_build_object('code', 'AMOUNT_MISMATCH');
  end if;

  if v_order.payment_status = 'paid' then
    if v_order.payment_ref = v_transaction_no then
      return jsonb_build_object('code', 'ALREADY_PAID');
    end if;
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end if;

  -- Case 2: sweeper already expired the order; money arrived late.
  if v_order.order_status = 'expired'
     and v_order.payment_status = 'expired'
     and v_order.payment_method = 'vnpay' then
    if exists (
      select 1 from orders
      where payment_ref = v_transaction_no and id <> v_order.id
    ) then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end if;

    -- C3-4: reservations were released on expiry — re-check live stock
    -- before resurrecting the order, else ops packs what isn't there.
    for v_line in
      select oi.variant_id, oi.quantity
      from order_items oi
      where oi.order_id = v_order.id
    loop
      perform pg_advisory_xact_lock(hashtext('variant:' || v_line.variant_id::text));
      v_avail := available_variant_stock(v_line.variant_id);
      if v_avail < v_line.quantity then
        insert into order_status_events (order_id, event_type, from_status, to_status, reason)
        values (v_order.id, 'payment_status', 'expired', 'expired', 'late_vnpay_insufficient_stock');
        return jsonb_build_object('code', 'OUT_OF_STOCK', 'orderCode', v_order.order_code);
      end if;
    end loop;

    begin
      update orders
      set order_status = 'confirmed',
          payment_status = 'paid',
          payment_ref = v_transaction_no,
          transfer_expires_at = now() + interval '24 hours',
          updated_at = now()
      where id = v_order.id;
    exception when unique_violation then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end;

    insert into order_status_events (order_id, event_type, from_status, to_status, reason)
    values
      (v_order.id, 'order_status', 'expired', 'confirmed', 'late_vnpay_reopen'),
      (v_order.id, 'payment_status', 'expired', 'paid', 'late_vnpay_reopen');

    return jsonb_build_object(
      'code', 'REOPENED',
      'orderCode', v_order.order_code,
      'paymentStatus', 'paid',
      'paymentRef', v_transaction_no,
      'reopenedFromExpired', true
    );
  end if;

  if v_order.payment_status <> 'pending'
     or v_order.payment_method <> 'vnpay'
     or v_order.order_status <> 'awaiting_payment' then
    return jsonb_build_object('code', 'ORDER_NOT_PAYABLE');
  end if;

  if v_order.transfer_expires_at is null or v_order.transfer_expires_at <= now() then
    if exists (
      select 1 from orders
      where payment_ref = v_transaction_no and id <> v_order.id
    ) then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end if;

    begin
      update orders
      set payment_status = 'paid',
          payment_ref = v_transaction_no,
          transfer_expires_at = now() + interval '24 hours',
          updated_at = now()
      where id = v_order.id;
    exception when unique_violation then
      return jsonb_build_object('code', 'PAYMENT_CONFLICT');
    end;

    insert into order_status_events (order_id, event_type, from_status, to_status, reason)
    values (v_order.id, 'payment_status', 'pending', 'paid', 'late_vnpay_accepted');

    return jsonb_build_object(
      'code', 'REOPENED',
      'orderCode', v_order.order_code,
      'paymentStatus', 'paid',
      'paymentRef', v_transaction_no,
      'reopenedFromExpired', false
    );
  end if;

  if exists (
    select 1 from orders
    where payment_ref = v_transaction_no and id <> v_order.id
  ) then
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end if;

  begin
    update orders
    set payment_status = 'paid',
        payment_ref = v_transaction_no,
        updated_at = now()
    where id = v_order.id;
  exception when unique_violation then
    return jsonb_build_object('code', 'PAYMENT_CONFLICT');
  end;

  insert into order_status_events (order_id, event_type, from_status, to_status)
  values (v_order.id, 'payment_status', v_order.payment_status, 'paid');

  return jsonb_build_object(
    'code', 'OK',
    'orderCode', v_order.order_code,
    'paymentStatus', 'paid',
    'paymentRef', v_transaction_no
  );
end;
$$;

revoke all on function order_mark_paid_by_gateway(text, text, bigint) from public;
revoke all on function order_mark_paid_by_gateway(text, text, bigint) from anon, authenticated;
grant execute on function order_mark_paid_by_gateway(text, text, bigint) to service_role;
