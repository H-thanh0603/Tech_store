-- Regression for the 2026-08-16 upgrade: notification outbox triggers,
-- release_expired_reservations, normalize_vietnamese, audit listing RPC and
-- customer GDPR RPCs.

begin;
select plan(8);

-- --- normalize_vietnamese -------------------------------------------------
select is(
  normalize_vietnamese('Điện Thoại iPhone 15'),
  'dien thoai iphone 15',
  'normalize_vietnamese strips Vietnamese diacritics and lowercases'
);

-- --- order insert queues an outbox row ------------------------------------
insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, customer_email, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, discount_total, shipping_total, total
) values (
  'b0000000-0000-0000-0000-000000000001',
  'TS-UPG-001',
  'b0000000-0000-0000-0000-000000000002',
  repeat('b', 64),
  'Upgrade Fixture',
  '0902000001',
  'buyer@example.com',
  '{"province":"HN","district":"HK","ward":"1","streetAddress":"1 Test"}'::jsonb,
  'cod',
  'pending',
  'pending',
  1000000, 0, 0, 1000000
);

select is(
  (select count(*)::integer from notification_outbox
   where type = 'order_confirmation' and payload->>'orderCode' = 'TS-UPG-001'),
  1,
  'order insert queues an order_confirmation outbox row'
);

-- --- release_expired_reservations ------------------------------------------
insert into products (id, category_id, name, slug, description, is_published, is_featured, is_archived)
values (
  'b0000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000001',
  'Upgrade Test Product',
  'upgrade-test-product',
  'fixture',
  false,
  false,
  false
);

insert into product_variants (id, product_id, sku, attributes, regular_price, sale_price, is_active)
values (
  'b0000000-0000-0000-0000-000000000012',
  'b0000000-0000-0000-0000-000000000011',
  'UPG-TEST-SKU',
  '{}'::jsonb,
  1000000,
  null,
  true
);

insert into inventory (variant_id, quantity, reserved_quantity, low_stock_threshold)
values ('b0000000-0000-0000-0000-000000000012', 10, 1, 2);

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  transfer_expires_at,
  subtotal, discount_total, shipping_total, total
) values (
  'b0000000-0000-0000-0000-000000000021',
  'TS-UPG-002',
  'b0000000-0000-0000-0000-000000000022',
  repeat('c', 64),
  'Expired Fixture',
  '0902000002',
  '{"province":"HN","district":"HK","ward":"1","streetAddress":"1 Test"}'::jsonb,
  'bank_transfer',
  'pending',
  'awaiting_payment',
  now() - interval '1 hour',
  1000000, 0, 0, 1000000
);

insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
values ('b0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000012', 1, now() - interval '1 hour');

set local role service_role;

select release_expired_reservations();

select is(
  (select order_status from orders where order_code = 'TS-UPG-002'),
  'expired',
  'release_expired_reservations marks overdue awaiting_payment order expired'
);

select ok(
  (select released_at is not null from inventory_reservations
   where order_id = 'b0000000-0000-0000-0000-000000000021'),
  'expired order reservation is released'
);

-- --- admin_list_audit_logs ---------------------------------------------------
insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
values ('product_create', 'product', 'b0000000-0000-0000-0000-000000000011', '{}'::jsonb, 'upg-test');

select is(
  (admin_list_audit_logs('product', null, null, null, 10, 0) ->> 'total')::integer >= 1,
  true,
  'admin_list_audit_logs filters by entity_type product'
);

select is(
  (admin_list_audit_logs('coupon', null, null, null, 10, 0) ->> 'total')::integer,
  (select count(*)::integer from admin_audit_logs where entity_type = 'coupon'),
  'admin_list_audit_logs total matches coupon row count'
);

-- --- customer GDPR RPCs require auth ----------------------------------------
set local role authenticated;

select is(
  customer_export_my_data() ->> 'code',
  'UNAUTHORIZED',
  'customer_export_my_data returns UNAUTHORIZED without auth.uid()'
);

select is(
  customer_delete_my_data() ->> 'code',
  'UNAUTHORIZED',
  'customer_delete_my_data returns UNAUTHORIZED without auth.uid()'
);

select * from finish();
rollback;
