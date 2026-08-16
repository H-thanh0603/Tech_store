-- Admin audit log listing/export + GDPR customer data portability & erasure.

-- ─── admin_list_audit_logs: filtered paged listing (service_role only) ───────

create or replace function admin_list_audit_logs(
  p_entity_type text default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_rows jsonb;
begin
  select count(*) into v_total
  from admin_audit_logs
  where (p_entity_type is null or entity_type = p_entity_type)
    and (p_action is null or action = p_action)
    and (p_from is null or created_at >= p_from)
    and (p_to is null or created_at <= p_to);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'action', action, 'entityType', entity_type,
    'entityId', entity_id, 'payload', payload,
    'actorLabel', actor_label, 'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from admin_audit_logs
    where (p_entity_type is null or entity_type = p_entity_type)
      and (p_action is null or action = p_action)
      and (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    offset greatest(coalesce(p_offset, 0), 0)
  ) t;

  return jsonb_build_object('code', 'OK', 'total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function admin_list_audit_logs(text, text, timestamptz, timestamptz, integer, integer) from public;
revoke all on function admin_list_audit_logs(text, text, timestamptz, timestamptz, integer, integer) from anon, authenticated;
grant execute on function admin_list_audit_logs(text, text, timestamptz, timestamptz, integer, integer) to service_role;

-- ─── customer_export_my_data: GDPR data portability ──────────────────────────

create or replace function customer_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_orders jsonb;
  v_reviews jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;

  select jsonb_build_object(
    'fullName', full_name, 'phone', phone, 'email', email,
    'addressLine', address_line, 'city', city,
    'district', district, 'ward', ward, 'createdAt', created_at
  ) into v_profile
  from customer_profiles where user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderCode', o.order_code, 'orderStatus', o.order_status,
    'paymentStatus', o.payment_status, 'paymentMethod', o.payment_method,
    'customerName', o.customer_name, 'customerPhone', o.customer_phone,
    'customerEmail', o.customer_email, 'address', o.address_snapshot,
    'note', o.note, 'subtotal', o.subtotal, 'discountTotal', o.discount_total,
    'shippingTotal', o.shipping_total, 'total', o.total, 'createdAt', o.created_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'productName', oi.product_name, 'sku', oi.sku, 'attributes', oi.attributes,
        'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total
      ) order by oi.id), '[]'::jsonb)
      from order_items oi where oi.order_id = o.id
    )
  ) order by o.created_at desc), '[]'::jsonb)
  into v_orders
  from orders o where o.user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productId', r.product_id, 'authorName', r.author_name, 'rating', r.rating,
    'title', r.title, 'body', r.body, 'createdAt', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  into v_reviews
  from product_reviews r where r.user_id = v_uid;

  return jsonb_build_object(
    'code', 'OK',
    'exportedAt', now(),
    'profile', coalesce(v_profile, 'null'::jsonb),
    'orders', v_orders,
    'reviews', v_reviews
  );
end;
$$;

revoke all on function customer_export_my_data() from public;
grant execute on function customer_export_my_data() to authenticated;

-- ─── customer_delete_my_data: GDPR erasure (anonymize, keep financial rows) ──
-- Orders/reviews are kept for tax/warranty records but unlinked from the user;
-- profile and restock waitlist rows are deleted.

create or replace function customer_delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_orders integer;
  v_reviews integer;
  v_restock integer;
  v_profile integer;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  update orders set user_id = null where user_id = v_uid;
  get diagnostics v_orders = row_count;

  update product_reviews set user_id = null where user_id = v_uid;
  get diagnostics v_reviews = row_count;

  delete from product_restock_requests
  where v_email <> '' and lower(email) = v_email;
  get diagnostics v_restock = row_count;

  delete from customer_profiles where user_id = v_uid;
  get diagnostics v_profile = row_count;

  return jsonb_build_object(
    'code', 'OK',
    'ordersAnonymized', v_orders,
    'reviewsAnonymized', v_reviews,
    'restockRequestsDeleted', v_restock,
    'profileDeleted', v_profile
  );
end;
$$;

revoke all on function customer_delete_my_data() from public;
grant execute on function customer_delete_my_data() to authenticated;
