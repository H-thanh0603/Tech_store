-- Merchant scheduled digest (port of commerce-agents digest flow).
--
-- A daily cron composes snapshot + alerts + open orders into one row; the
-- merchant assistant reads the latest as context. Service-role only.

create table merchant_digests (
  id uuid primary key default gen_random_uuid(),
  period text not null check (length(period) <= 32),
  payload jsonb not null check (octet_length(payload::text) <= 20000),
  created_at timestamptz not null default now()
);

create index merchant_digests_created_at_idx on merchant_digests (created_at desc);

alter table merchant_digests enable row level security;
-- No policies: only service_role reads/writes.
