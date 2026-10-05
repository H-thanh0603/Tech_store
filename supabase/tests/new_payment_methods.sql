-- pgTAP: deferred payment methods (bank_card, momo, zalopay, installment).
-- Each must behave like bank_transfer: OK + awaiting_payment + 24h expiry.
-- Unknown methods stay INTERNAL_ERROR (safe gate, no info leak).

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

set local role anon;

select cart_add_item(repeat('a', 64), '40000000-0000-0000-0000-000000000001', 1)->>'code';
select cart_add_item(repeat('b', 64), '40000000-0000-0000-0000-000000000001', 1)->>'code';
select cart_add_item(repeat('c', 64), '40000000-0000-0000-0000-000000000001', 1)->>'code';
select cart_add_item(repeat('d', 64), '40000000-0000-0000-0000-000000000001', 1)->>'code';

select is(
  (place_order(
    repeat('a', 64),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    repeat('e', 64),
    '{"customerName":"Nguyen Van M","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'momo', null
  )->>'code'),
  'OK',
  'momo checkout creates order'
);

select is(
  (select order_status from orders where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'awaiting_payment',
  'momo order awaits payment'
);

select ok(
  (select transfer_expires_at from orders where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null,
  'momo order has a payment deadline'
);

select is(
  (place_order(
    repeat('b', 64),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    repeat('f', 63) || '0',
    '{"customerName":"Nguyen Van Z","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'zalopay', null
  )->>'code'),
  'OK',
  'zalopay checkout creates order'
);

select is(
  (place_order(
    repeat('c', 64),
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    repeat('f', 63) || '1',
    '{"customerName":"Nguyen Van B","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'bank_card', null
  )->>'code'),
  'OK',
  'bank_card checkout creates order'
);

select is(
  (place_order(
    repeat('d', 64),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    repeat('f', 63) || '2',
    '{"customerName":"Nguyen Van I","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'installment', null
  )->>'code'),
  'OK',
  'installment checkout creates order'
);

select is(
  (place_order(
    repeat('d', 64),
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    repeat('f', 63) || '3',
    '{"customerName":"Nguyen Van X","customerPhone":"0901234567","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"123 Xuan Thuy"}'::jsonb,
    'cash', null
  )->>'code'),
  'INTERNAL_ERROR',
  'unknown payment method stays a safe INTERNAL_ERROR'
);

select like(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'orders_payment_method_check'),
  '%momo%',
  'orders check constraint lists the new methods'
);

select like(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'orders_payment_expiry_required'),
  '%bank_card%',
  'expiry constraint covers the new holding methods'
);

select * from finish();
rollback;
