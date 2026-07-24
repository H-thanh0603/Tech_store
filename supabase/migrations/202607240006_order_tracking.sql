-- Rate-limited guest order tracking. Wrong code, wrong phone, and rate-limit
-- responses are identical. A successful match rotates the access-token hash.

create function order_track(
  p_order_code text,
  p_phone text,
  p_identity_hash text,
  p_new_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz;
  v_attempts integer;
  v_order orders%rowtype;
  v_items jsonb;
  v_not_found constant jsonb := jsonb_build_object('code', 'ORDER_NOT_FOUND');
begin
  if p_identity_hash !~ '^[a-f0-9]{64}$' or p_new_access_token_hash !~ '^[a-f0-9]{64}$' then
    return v_not_found;
  end if;

  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('order_track', p_identity_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;
  if v_attempts > 5 then return v_not_found; end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
    and regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  for update;
  if not found then return v_not_found; end if;

  if v_order.payment_method = 'bank_transfer'
     and v_order.payment_status = 'pending'
     and v_order.transfer_expires_at <= now() then
    update orders set payment_status = 'expired', order_status = 'expired'
    where id = v_order.id
    returning * into v_order;
    update inventory_reservations set released_at = now()
    where order_id = v_order.id and released_at is null;
    update coupon_redemptions set released_at = now()
    where order_id = v_order.id and released_at is null;
  end if;

  update orders set access_token_hash = p_new_access_token_hash where id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', product_name, 'sku', sku, 'attributes', attributes,
    'unitPrice', unit_price, 'quantity', quantity, 'lineTotal', line_total
  ) order by id), '[]'::jsonb)
  into v_items from order_items where order_id = v_order.id;

  return jsonb_build_object(
    'code', 'OK', 'orderCode', v_order.order_code,
    'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'orderStatus', v_order.order_status, 'subtotal', v_order.subtotal,
    'discountTotal', v_order.discount_total, 'shippingTotal', 0, 'total', v_order.total,
    'transferExpiresAt', v_order.transfer_expires_at, 'items', v_items
  );
end;
$$;

revoke all on function order_track(text, text, text, text) from public;
grant execute on function order_track(text, text, text, text) to anon, authenticated;
