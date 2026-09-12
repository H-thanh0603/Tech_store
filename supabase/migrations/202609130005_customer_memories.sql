-- Chat memory (port of commerce-agents memory extraction, Messages path).
--
-- One row per chat session (client-generated session id, stored as SHA-256).
-- Facts are shopping preferences only (budget, use-cases, brands) — never
-- phones, addresses, or order data. Service-role only: app access via the
-- assistant chat route.

create table customer_memories (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique check (session_key ~ '^[a-f0-9]{64}$'),
  facts jsonb not null default '{}'::jsonb check (octet_length(facts::text) <= 2000),
  updated_at timestamptz not null default now()
);

alter table customer_memories enable row level security;
-- No policies: only service_role (assistant backend) reads/writes.
