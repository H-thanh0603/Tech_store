-- Agent approval hardening: staged changes expire + decision metadata.
-- Human approval must be timely (24h) and separated (approver != stager).

alter table assistant_staged_changes
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

update assistant_staged_changes
set expires_at = created_at + interval '24 hours'
where expires_at is null or expires_at <= created_at;

create index if not exists staged_changes_pending_idx
  on assistant_staged_changes (status, expires_at)
  where status = 'staged';

-- Allowlist the daily cost-guard buckets: unknown actions return limited=true
-- (fail-closed), so assistant_chat_daily / merchant_chat_daily must be listed
-- or every chat would 429 on first call.
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
    'assistant_chat_daily', 'merchant_chat_daily',
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
