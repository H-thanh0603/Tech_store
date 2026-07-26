-- Admin order ops: status transitions and reservation release / stock deduction.

begin;
select plan(6);

-- Seed a dedicated order with one reservation (no place_order dependency).
-- Insert product unpublished first — publish trigger requires an active variant.
insert into products (id, category_id, brand_id, name, slug, description, is_published, is_featured, is_archived)
values (
  'a0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  null,
  'Admin Test Product',
  'admin-test-product',
  'fixture',
  false,
  false,
  false
) on conflict (id) do nothing;

insert into product_variants (id, product_id, sku, attributes, regular_price, sale_price, is_active)
values (
  'a0000000-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000001',
  'ADMIN-TEST-SKU',
  '{}'::jsonb,
  1000000,
  null,
  true
) on conflict (id) do nothing;

insert into inventory (variant_id, quantity, reserved_quantity, low_stock_threshold)
values ('a0000000-0000-0000-0000-000000000011', 10, 0, 2)
on conflict (variant_id) do update
set quantity = 10, reserved_quantity = 0;

update products
set is_published = true
where id = 'a0000000-0000-0000-0000-000000000001';

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, discount_total, shipping_total, total
) values (
  'a0000000-0000-0000-0000-000000000021',
  'TS-ADMIN-001',
  'a0000000-0000-0000-0000-000000000031',
  repeat('a', 64),
  'Admin Fixture',
  '0901000001',
  '{"province":"HN","district":"HK","ward":"1","streetAddress":"1 Test"}'::jsonb,
  'cod',
  'pending',
  'pending',
  1000000, 0, 0, 1000000
) on conflict (order_code) do nothing;

insert into order_items (
  order_id, variant_id, product_name, sku, attributes, unit_price, quantity, line_total
)
select
  'a0000000-0000-0000-0000-000000000021',
  'a0000000-0000-0000-0000-000000000011',
  'Admin Test Product',
  'ADMIN-TEST-SKU',
  '{}'::jsonb,
  1000000,
  2,
  2000000
where not exists (
  select 1 from order_items
  where order_id = 'a0000000-0000-0000-0000-000000000021'
    and sku = 'ADMIN-TEST-SKU'
);

insert into inventory_reservations (order_id, variant_id, quantity, expires_at)
select 'a0000000-0000-0000-0000-000000000021',
       'a0000000-0000-0000-0000-000000000011',
       2,
       null
where not exists (
  select 1 from inventory_reservations
  where order_id = 'a0000000-0000-0000-0000-000000000021'
);

-- Illegal jump pending -> shipping
select is(
  (admin_update_order('TS-ADMIN-001', 'shipping', null)->>'code'),
  'INVALID_TRANSITION',
  'rejects illegal status jump'
);

-- Mark paid
select is(
  (admin_update_order('TS-ADMIN-001', null, 'paid')->>'code'),
  'OK',
  'marks payment paid'
);

select is(
  (select payment_status from orders where order_code = 'TS-ADMIN-001'),
  'paid',
  'payment_status is paid'
);

-- Confirm then cancel releases reservation
select ok(
  (admin_update_order('TS-ADMIN-001', 'confirmed', null)->>'code') = 'OK',
  'confirm order'
);

select is(
  (admin_update_order('TS-ADMIN-001', 'cancelled', null, 'Customer requested cancellation')->>'code'),
  'OK',
  'cancel order'
);

select ok(
  (
    select released_at is not null
    from inventory_reservations
    where order_id = 'a0000000-0000-0000-0000-000000000021'
    limit 1
  ),
  'cancel releases inventory reservation'
);

select * from finish();
rollback;
