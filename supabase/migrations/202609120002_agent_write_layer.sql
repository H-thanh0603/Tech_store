-- Agent write layer (docs/AGENT_LAYER.md tasks 4-5): scoped bearer tokens for
-- external AI agents plus human-in-the-loop order intents.
--
-- Trust model: tokens are minted out-of-band (scripts/mint-agent-token.mjs),
-- stored as SHA-256 only, and gated to ONE scope today: cart:write, i.e. the
-- agent may stage an order intent but money only moves when a human approves
-- on the website. Tables are RLS-on with zero public policies; every access
-- goes through SECURITY DEFINER server code with the service_role client.

-- Forward-fix for check_rate_limit allowlist (same pattern as
-- 202609120001_agent_rate_limit_buckets.sql): unknown buckets 429 on first
-- call, so new agent buckets must be allowlisted here.
create or replace function check_rate_limit(
  p_action text,
  p_identity text,
  p_limit integer default 5,
  p_window_minutes integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_bucket timestamptz;
  v_attempts integer;
  v_allowed boolean;
begin
  if p_action is null or length(p_action) = 0 or length(p_action) > 64 then
    return true;
  end if;
  v_allowed := p_action in (
    'auth_magic', 'auth_password', 'auth_signup',
    'admin_login', 'admin_mfa',
    'coupon_apply', 'suggest', 'csp_report',
    'export_audit', 'export_orders',
    'place_order',
    'assistant_chat', 'merchant_chat',
    'agents_catalog', 'agents_orders',
    'agents_intents',
    'tap_action'
  ) or p_action like 'tap_%';
  if not v_allowed then
    return true;
  end if;
  if p_identity is null or length(p_identity) = 0 then
    return true;
  end if;
  if p_limit is null or p_limit < 1 then
    return true;
  end if;

  v_hash := encode(digest(p_identity, 'sha256'), 'hex');
  v_bucket := date_bin(
    (p_window_minutes || ' minutes')::interval,
    now(),
    '2000-01-01T00:00:00Z'::timestamptz
  );

  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values (p_action, v_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;

  return v_attempts > p_limit;
end;
$$;

revoke all on function check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function check_rate_limit(text, text, integer, integer) to service_role;

create table if not exists agent_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (char_length(token_hash) = 64),
  scopes text[] not null default '{cart:write}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint agent_tokens_scopes_known check (scopes <@ '{cart:write}')
);

alter table agent_tokens enable row level security;

create table if not exists agent_order_intents (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references agent_tokens (id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 10),
  status text not null default 'pending'
    check (status in ('pending', 'converted', 'declined', 'expired')),
  approve_token_hash text not null unique check (char_length(approve_token_hash) = 64),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  order_code text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table agent_order_intents enable row level security;

create index if not exists agent_order_intents_token_idx on agent_order_intents (token_id);
create index if not exists agent_order_intents_status_idx on agent_order_intents (status);
