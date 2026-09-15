-- C3 checkout concurrency regression (audit Phase 0).
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function(
  'public',
  'place_order_internal',
  array['text', 'uuid', 'text', 'jsonb', 'text', 'text', 'uuid'],
  'place_order_internal exists with identity arg'
);

select has_function(
  'public',
  'purge_checkout_hot_tables',
  array['integer'],
  'purge_checkout_hot_tables helper exists'
);

select has_index(
  'public',
  'coupon_redemptions',
  'coupon_redemptions_active_idx',
  'partial index on active coupon redemptions exists'
);

select has_index(
  'public',
  'inventory_reservations',
  'inventory_reservations_expires_idx',
  'reservations expiry index exists for sweeps/purges'
);

-- Advisory-lock primitives used by the hardening must exist.
select ok(
  (select count(*)::integer from pg_proc where proname = 'pg_advisory_xact_lock') > 0,
  'pg_advisory_xact_lock available for idempotency/variant/coupon locks'
);

-- Late-reopen path must distinguish stock failure (OUT_OF_STOCK branch present).
select ok(
  (select pg_get_functiondef(oid) like '%late_vnpay_insufficient_stock%'
   from pg_proc where proname = 'order_mark_paid_by_gateway' limit 1),
  'late VNPay reopen re-checks stock before confirming'
);

select * from finish();
rollback;
