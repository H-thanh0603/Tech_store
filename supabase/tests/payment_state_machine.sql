-- VNPay callbacks may only settle payable VNPay orders and must be idempotent
-- for the same gateway transaction reference.

begin;
select plan(10);

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status, transfer_expires_at,
  subtotal, discount_total, shipping_total, total
) values
  (
    'c1000000-0000-0000-0000-000000000001', 'TS-PAY-EXPIRED',
    'c1000000-0000-4000-8000-000000000001', repeat('1', 64),
    'Expired Payment', '0903000001', '{}'::jsonb,
    'vnpay', 'pending', 'awaiting_payment', now() - interval '1 minute',
    1000, 0, 0, 1000
  ),
  (
    'c1000000-0000-0000-0000-000000000002', 'TS-PAY-VALID',
    'c1000000-0000-4000-8000-000000000002', repeat('2', 64),
    'Valid Payment', '0903000002', '{}'::jsonb,
    'vnpay', 'pending', 'awaiting_payment', now() + interval '1 hour',
    1000, 0, 0, 1000
  ),
  (
    'c1000000-0000-0000-0000-000000000003', 'TS-PAY-SECOND',
    'c1000000-0000-4000-8000-000000000003', repeat('3', 64),
    'Second Payment', '0903000003', '{}'::jsonb,
    'vnpay', 'pending', 'awaiting_payment', now() + interval '1 hour',
    1000, 0, 0, 1000
  ),
  (
    'c1000000-0000-0000-0000-000000000004', 'TS-PAY-AMOUNT',
    'c1000000-0000-4000-8000-000000000004', repeat('4', 64),
    'Amount Payment', '0903000004', '{}'::jsonb,
    'vnpay', 'pending', 'awaiting_payment', now() + interval '1 hour',
    1000, 0, 0, 1000
  );

set local role service_role;

select is(
  order_mark_paid_by_gateway('TS-PAY-EXPIRED', 'VNP-EXPIRED', 100000)->>'code',
  'ORDER_EXPIRED',
  'late callback cannot pay an expired order'
);
select is(
  (select payment_status from orders where order_code = 'TS-PAY-EXPIRED'),
  'pending',
  'expired callback leaves payment pending'
);

select is(
  order_mark_paid_by_gateway('TS-PAY-VALID', 'VNP-VALID', 100000)->>'code',
  'OK',
  'payable VNPay order is marked paid'
);
select results_eq(
  $$select payment_status, payment_ref from orders where order_code = 'TS-PAY-VALID'$$,
  $$values ('paid'::text, 'VNP-VALID'::text)$$,
  'successful payment stores status and transaction reference'
);
select is(
  order_mark_paid_by_gateway('TS-PAY-VALID', 'VNP-VALID', 100000)->>'code',
  'ALREADY_PAID',
  'same transaction replay is idempotent'
);
select is(
  order_mark_paid_by_gateway('TS-PAY-VALID', 'VNP-DIFFERENT', 100000)->>'code',
  'PAYMENT_CONFLICT',
  'paid order rejects a different transaction reference'
);

select is(
  order_mark_paid_by_gateway('TS-PAY-SECOND', 'VNP-VALID', 100000)->>'code',
  'PAYMENT_CONFLICT',
  'gateway transaction cannot pay two orders'
);
select is(
  (select payment_status from orders where order_code = 'TS-PAY-SECOND'),
  'pending',
  'transaction conflict leaves second order pending'
);

select is(
  order_mark_paid_by_gateway('TS-PAY-AMOUNT', 'VNP-AMOUNT', 99900)->>'code',
  'AMOUNT_MISMATCH',
  'amount mismatch is rejected'
);
select is(
  (select payment_status from orders where order_code = 'TS-PAY-AMOUNT'),
  'pending',
  'amount mismatch leaves payment pending'
);

select * from finish();
rollback;
