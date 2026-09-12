-- Internal invoices (hóa đơn nội bộ). Numbered record of what was sold
-- before a certified e-invoice provider is contracted. One row per order.
-- Service-role only: app access via RPC/admin backend.

create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  invoice_number text not null unique check (length(invoice_number) <= 32),
  total numeric(12, 2) not null check (total > 0),
  vat_rate numeric(5, 4) not null default 0.1 check (vat_rate >= 0 and vat_rate < 1),
  vat_amount numeric(12, 2) not null check (vat_amount >= 0),
  customer_name text not null check (length(customer_name) <= 200),
  tax_code text check (tax_code is null or tax_code ~ '^[0-9]{10}(-[0-9]{3})?$'),
  company_name text check (length(coalesce(company_name, '')) <= 200),
  state text not null default 'issued' check (
    state in ('issued', 'cancelled')
  ),
  created_by_label text check (length(coalesce(created_by_label, '')) <= 120),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index invoices_created_at_idx on invoices (created_at desc);

alter table invoices enable row level security;
-- No policies: only service_role (admin backend) reads/writes.
