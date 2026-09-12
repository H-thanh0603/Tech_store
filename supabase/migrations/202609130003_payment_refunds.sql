-- VNPay refund ledger. Records every refund attempt (mock or live) so the
-- manual-dashboard flow and the future auto-refund share one audit trail.
-- Service-role only (same pattern as order_returns): app access via RPC.

create table payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  provider text not null default 'vnpay' check (provider in ('vnpay', 'manual')),
  amount numeric(12, 2) not null check (amount > 0),
  state text not null default 'requested' check (
    state in ('requested', 'mock_recorded', 'submitted', 'succeeded', 'failed')
  ),
  provider_request_id text check (length(coalesce(provider_request_id, '')) <= 128),
  provider_txn_no text check (length(coalesce(provider_txn_no, '')) <= 64),
  error text check (length(coalesce(error, '')) <= 500),
  created_by_label text check (length(coalesce(created_by_label, '')) <= 120),
  created_at timestamptz not null default now()
);

create index payment_refunds_order_id_idx on payment_refunds (order_id);
create index payment_refunds_state_idx on payment_refunds (state, created_at desc);

alter table payment_refunds enable row level security;
-- No policies: only service_role (admin backend) reads/writes.
