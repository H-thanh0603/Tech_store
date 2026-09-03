-- Hardening: indexes + retention + checkout IP rate-limit
-- Addresses DB-020, DB-040, DB-044, DB-010

-- 1. DB-020: index for dashboard and admin_list_orders ORDER BY created_at
create index if not exists orders_created_at_idx on orders (created_at desc);

-- 2. DB-040/044: extend retention to outbox + carts
create or replace function purge_expired_logs(
  p_audit_days integer default 180,
  p_analytics_days integer default 90,
  p_rate_limit_days integer default 2,
  p_outbox_days integer default 30,
  p_cart_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_audit_deleted int;
  v_analytics_deleted int;
  v_rate_deleted int;
  v_outbox_deleted int;
  v_cart_deleted int;
  v_cart_deleted2 int;
begin
  if p_audit_days < 30 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Audit log phải giữ ít nhất 30 ngày.');
  end if;
  if p_analytics_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Analytics phải giữ ít nhất 7 ngày.');
  end if;
  if p_rate_limit_days < 1 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Rate limit phải giữ ít nhất 1 ngày.');
  end if;
  if p_outbox_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Outbox phải giữ ít nhất 7 ngày.');
  end if;
  if p_cart_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Cart phải giữ ít nhất 7 ngày.');
  end if;

  delete from admin_audit_logs
  where created_at < now() - (p_audit_days || ' days')::interval;
  get diagnostics v_audit_deleted = row_count;

  delete from analytics_events
  where received_at < now() - (p_analytics_days || ' days')::interval;
  get diagnostics v_analytics_deleted = row_count;

  delete from request_rate_limits
  where bucket_started_at < now() - (p_rate_limit_days || ' days')::interval;
  get diagnostics v_rate_deleted = row_count;

  -- Outbox: only purge terminal rows, keep pending for retry
  delete from notification_outbox
  where status in ('sent', 'skipped', 'failed')
    and queued_at < now() - (p_outbox_days || ' days')::interval;
  get diagnostics v_outbox_deleted = row_count;

  -- Carts: prune abandoned open carts idle > p_cart_days (default 90d)
  delete from carts
  where status = 'open'
    and updated_at < now() - (p_cart_days || ' days')::interval
    and not exists (select 1 from cart_items where cart_id = carts.id);
  get diagnostics v_cart_deleted = row_count;

  -- Also delete open carts with items that have been idle (no update) for 2x period
  delete from carts
  where status = 'open'
    and updated_at < now() - ((p_cart_days * 2) || ' days')::interval;
  get diagnostics v_cart_deleted2 = row_count;
  v_cart_deleted := v_cart_deleted + v_cart_deleted2;

  return jsonb_build_object(
    'code', 'OK',
    'auditDeleted', v_audit_deleted,
    'analyticsDeleted', v_analytics_deleted,
    'rateLimitDeleted', v_rate_deleted,
    'outboxDeleted', v_outbox_deleted,
    'cartDeleted', v_cart_deleted
  );
end;
$$;

revoke all on function purge_expired_logs(integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function purge_expired_logs(integer, integer, integer, integer, integer) to service_role;
-- keep old 3-arg signature for backwards compat
revoke all on function purge_expired_logs(integer, integer, integer) from public, anon, authenticated;
grant execute on function purge_expired_logs(integer, integer, integer) to service_role;

-- 3. DB-010: checkout rate-limit bound to client identity (IP) not just cart token
-- Recreate place_order wrapper with optional p_client_identity_hash. When
-- provided (sha256 of IP+cart hash from server), it is the rate-limit key;
-- otherwise falls back to cart token hash for backwards compat.

create or replace function place_order(
  p_cart_token_hash text,
  p_idempotency_key uuid,
  p_order_access_token_hash text,
  p_customer jsonb,
  p_payment_method text,
  p_coupon_code text default null,
  p_client_identity_hash text default null
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
  v_identity text;
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

  -- Use client identity hash (IP-bound) when provided, else cart hash for compat
  v_identity := coalesce(nullif(p_client_identity_hash, ''), p_cart_token_hash);
  -- Identity must be 64 hex if provided as hash, else fall back
  if v_identity !~ '^[a-f0-9]{64}$' then
    v_identity := p_cart_token_hash;
  end if;

  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('place_order', v_identity, v_bucket, 1)
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

revoke all on function place_order(text, uuid, text, jsonb, text, text, text) from public;
grant execute on function place_order(text, uuid, text, jsonb, text, text, text) to anon, authenticated;
-- keep 6-arg compat grant
revoke all on function place_order(text, uuid, text, jsonb, text, text) from public;
grant execute on function place_order(text, uuid, text, jsonb, text, text) to anon, authenticated;
