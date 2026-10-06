-- pgTAP: customer self-cancel (customer_cancel_order).

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Fixtures: cancellable unpaid COD order + a paid VNPay order + a shipped order.
insert into products (id, category_id, brand_id, name, slug, description, is_published, is_archived)
values ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'Cancel Test', 'cancel-test', 'fixture', false, false)
on conflict (id) do nothing;

insert into product_variants (id, product_id, sku, attributes, regular_price, is_active)
values ('e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'CAN-1', '{}'::jsonb, 1000, true)
on conflict (id) do nothing;

insert into inventory (variant_id, quantity)
values ('e0000000-0000-0000-0000-000000000011', 5)
on conflict (variant_id) do nothing;

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'e0000000-0000-0000-0000-000000000002',
  'CAN-ORDER-1',
  gen_random_uuid(),
  repeat('c', 64),
  'Cancel Tester', '0901234567', '{}'::jsonb,
  'cod', 'pending', 'pending',
  2000, 2000
) on conflict (id) do nothing;

insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
values ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000011', 2, now() + interval '1 hour')
on conflict do nothing;

-- 1) Unpaid pending order cancels OK.
select is(
  (select (customer_cancel_order('CAN-ORDER-1', repeat('c', 64), '0901234567', 'doi y'))->>'code'),
  'OK',
  'unpaid pending order cancels OK'
);

-- 2) Status moved to cancelled.
select is(
  (select order_status from orders where order_code = 'CAN-ORDER-1'),
  'cancelled',
  'order status moved to cancelled'
);

-- 3) Reservations released.
select is(
  (select count(*) from inventory_reservations
   where order_id = 'e0000000-0000-0000-0000-000000000002' and released_at is null)::text,
  '0',
  'reservations released on self-cancel'
);

-- 4) Second cancel is NOT_CANCELLABLE (already terminal).
select is(
  (select (customer_cancel_order('CAN-ORDER-1', repeat('c', 64), '0901234567'))->>'code'),
  'NOT_CANCELLABLE',
  'second cancel rejected as not cancellable'
);

-- 5) Wrong token / phone never leaks: identical ORDER_NOT_FOUND.
select is(
  (select (customer_cancel_order('CAN-ORDER-1', repeat('d', 64), '0901234567'))->>'code'),
  'ORDER_NOT_FOUND',
  'wrong token returns ORDER_NOT_FOUND'
);

select is(
  (select (customer_cancel_order('CAN-ORDER-1', repeat('c', 64), '0999999999'))->>'code'),
  'ORDER_NOT_FOUND',
  'wrong phone returns ORDER_NOT_FOUND'
);

-- 6) Paid order cannot self-cancel (manual refund triage instead).
insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'e0000000-0000-0000-0000-000000000003',
  'CAN-ORDER-2',
  gen_random_uuid(),
  repeat('e', 64),
  'Cancel Tester', '0901234567', '{}'::jsonb,
  'vnpay', 'paid', 'confirmed',
  2000, 2000
) on conflict (id) do nothing;

select is(
  (select (customer_cancel_order('CAN-ORDER-2', repeat('e', 64), '0901234567'))->>'code'),
  'NOT_CANCELLABLE',
  'paid order cannot self-cancel'
);

-- 7) Shipped order cannot self-cancel.
insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'e0000000-0000-0000-0000-000000000004',
  'CAN-ORDER-3',
  gen_random_uuid(),
  repeat('f', 64),
  'Cancel Tester', '0901234567', '{}'::jsonb,
  'cod', 'pending', 'shipping',
  2000, 2000
) on conflict (id) do nothing;

select is(
  (select (customer_cancel_order('CAN-ORDER-3', repeat('f', 64), '0901234567'))->>'code'),
  'NOT_CANCELLABLE',
  'shipped order cannot self-cancel'
);

-- 8) Audit trail written with customer actor.
select is(
  (select count(*) from admin_audit_logs
   where action = 'cancel_order' and entity_id = 'CAN-ORDER-1'
     and actor_label = 'customer')::text,
  '1',
  'self-cancel audit logged with customer actor'
);

select finish();
rollback;
