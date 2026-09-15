-- Assistant abuse layer (scope gate + jailbreak detector + IP bans).
-- security_events: append-only log of blocked attempts (identity hashed,
-- sample truncated to 500 chars, never stores PII beyond the attempt text).
-- abuse_bans: active bans by identity hash; routes 403 while until > now().

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  identity_hash text not null,
  kind text not null,
  sample text not null default ''
);

create table if not exists abuse_bans (
  identity_hash text primary key,
  reason text not null,
  until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table security_events enable row level security;
alter table abuse_bans enable row level security;
-- No policies: only service_role (assistant backend) reads/writes.
