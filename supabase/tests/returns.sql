-- pgTAP tests for the return / refund workflow.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Fixtures: one completed order with a single item, stock reserved=0.
insert into products (id, category_id, brand_id, name, slug, description, is_published, is_archived)
values ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'Return Test', 'return-test', 'fixture', false, false)
on conflict (id) do nothing;

insert into product_variants (id, product_id, sku, attributes, regular_price, is_active)
values ('c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'RET-1', '{}'::jsonb, 1000, true)
on conflict (id) do nothing;

insert into inventory (variant_id, quantity)
values ('c0000000-0000-0000-0000-000000000011', 5)
on conflict (variant_id) do nothing;

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'c0000000-0000-0000-0000-000000000002',
  'RET-ORDER-1',
  gen_random_uuid(),
  repeat('a', 64),
  'Return Tester', '0901234567', '{}'::jsonb,
  'cod', 'paid', 'completed',
  2000, 2000
) on conflict (id) do nothing;

insert into order_items (order_id, variant_id, product_name, sku, unit_price, quantity, line_total)
values (
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000011',
  'Return Test', 'RET-1', 1000, 2, 2000
);

-- 1) Customer can request a return with the correct access token.
select is(
  (
    select (request_order_return(
      'RET-ORDER-1', repeat('a', 64), '0901234567', 'defective', 'loi'
    ))->>'code'
  ),
  'OK',
  'valid return request succeeds'
);

-- 2) The order moved to return_requested.
select is(
  (select order_status from orders where order_code = 'RET-ORDER-1'),
  'return_requested',
  'order status moved to return_requested'
);

-- 3) A second request for the same order is rejected.
select is(
  (
    select (request_order_return(
      'RET-ORDER-1', repeat('a', 64), '0901234567', 'defective'
    ))->>'code'
  ),
  'RETURN_ALREADY_REQUESTED',
  'duplicate return request rejected'
);

-- 4) Admin approval restocks and moves the order to returned.
select is(
  (
    select (admin_decide_return(
      (select id from order_returns where order_id = 'c0000000-0000-0000-0000-000000000002'),
      true, 'ok', 1500, 'tap'
    ))->>'code'
  ),
  'OK',
  'admin approval succeeds'
);

select is(
  (select order_status from orders where order_code = 'RET-ORDER-1'),
  'returned',
  'order status moved to returned'
);

-- 5) Stock went back up by the item quantity (2).
select is(
  (select quantity from inventory where variant_id = 'c0000000-0000-0000-0000-000000000011'),
  7,
  'returned items restocked with reason returned'
);

-- 6) The inventory adjustment row was written for the audit trail.
select is(
  (select count(*) from inventory_adjustments
   where variant_id = 'c0000000-0000-0000-0000-000000000011' and reason_code = 'returned'),
  1,
  'inventory adjustment logged'
);

select finish();
rollback;
