-- pgTAP: issue_invoice (internal VAT invoice, one per order).

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'f0000000-0000-0000-0000-000000000001',
  'INV-ORDER-1',
  gen_random_uuid(),
  repeat('1', 64),
  'Invoice Tester', '0901234567', '{}'::jsonb,
  'cod', 'pending', 'pending',
  1100000, 1100000
) on conflict (id) do nothing;

-- 1) First issue succeeds with a numbered invoice.
select is(
  (select (issue_invoice('f0000000-0000-0000-0000-000000000001', '0312345678', 'ACME', 'tap'))->>'code'),
  'OK',
  'first issue succeeds'
);

-- 2) Number shape INV-YYYYMMDD-######.
select matches(
  (select (issue_invoice('f0000000-0000-0000-0000-000000000002', null, null, 'tap'))->>'code'),
  'NOT_FOUND',
  'unknown order returns NOT_FOUND'
);

select matches(
  (select invoice_number from invoices where order_id = 'f0000000-0000-0000-0000-000000000001'),
  '^INV-',
  'invoice number has INV- prefix'
);

-- 3) VAT split recorded (10% inclusive: 1100000 -> 100000).
select is(
  (select vat_amount::integer from invoices where order_id = 'f0000000-0000-0000-0000-000000000001'),
  100000,
  'VAT amount split from total'
);

-- 4) Second issue returns ALREADY_ISSUED, no duplicate row.
select is(
  (select (issue_invoice('f0000000-0000-0000-0000-000000000001', null, null, 'tap'))->>'code'),
  'ALREADY_ISSUED',
  'duplicate issue returns ALREADY_ISSUED'
);

-- 5) Bad tax code rejected.
insert into orders (
  id, order_code, idempotency_key, access_token_hash,
  customer_name, customer_phone, address_snapshot,
  payment_method, payment_status, order_status,
  subtotal, total
) values (
  'f0000000-0000-0000-0000-000000000003',
  'INV-ORDER-3',
  gen_random_uuid(),
  repeat('3', 64),
  'Invoice Tester', '0901234567', '{}'::jsonb,
  'cod', 'pending', 'pending',
  500000, 500000
) on conflict (id) do nothing;

select is(
  (select (issue_invoice('f0000000-0000-0000-0000-000000000003', 'abc', null, 'tap'))->>'code'),
  'VALIDATION_ERROR',
  'bad tax code rejected'
);

select finish();
rollback;
