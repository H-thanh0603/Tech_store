-- Merchant campaign briefs (port of commerce-agents campaign flow).
--
-- TechStore has no campaign engine: a brief is an advisory proposal
-- (mechanic, discount, dates, execution checklist) that staff approve and
-- then execute manually via coupons/flash offers. Approval never mutates
-- catalog or pricing by itself. Service-role only.

create table campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 4 and 120),
  mechanic text not null check (
    mechanic in ('percent_off', 'fixed_off', 'bundle', 'free_shipping', 'flash_sale')
  ),
  discount_pct numeric(5, 2) check (discount_pct is null or (discount_pct > 0 and discount_pct <= 50)),
  starts_at date,
  ends_at date,
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  rationale text check (length(coalesce(rationale, '')) <= 1000),
  execution text not null check (length(execution) between 4 and 1000),
  status text not null default 'proposed' check (
    status in ('proposed', 'approved', 'rejected', 'executed')
  ),
  created_by_label text check (length(coalesce(created_by_label, '')) <= 120),
  decided_by_label text check (length(coalesce(decided_by_label, '')) <= 120),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index campaign_briefs_status_idx on campaign_briefs (status, created_at desc);

alter table campaign_briefs enable row level security;
-- No policies: only service_role (merchant backend) reads/writes.
