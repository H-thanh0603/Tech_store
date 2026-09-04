-- Merchant assistant staged changes (propose → preview → approve → apply).
--
-- Rows are written by the assistant backend (service_role) when a change is
-- staged, and flipped to applied/discarded on the approval surface. No
-- RLS access for anon/authenticated: staff reach rows only through the
-- Next.js API, which re-validates signatures + guardrails before executing.
-- Audit of the actual write stays in admin_audit_logs via the product actions.

create table if not exists assistant_staged_changes (
  id text primary key,
  kind text not null check (kind in ('publish', 'price', 'stock')),
  summary text not null check (char_length(summary) between 1 and 200),
  note text check (note is null or char_length(note) <= 500),
  action jsonb not null check (jsonb_typeof(action) = 'object'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  signature text not null check (char_length(signature) = 64),
  status text not null default 'staged' check (status in ('staged', 'applied', 'discarded')),
  created_by uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

alter table assistant_staged_changes enable row level security;

-- Service role bypasses RLS; no policy for anon/authenticated on purpose:
-- the API is the only reader/writer and enforces staff session + signature.
create index if not exists assistant_staged_changes_status_idx
  on assistant_staged_changes (status, created_at desc);
