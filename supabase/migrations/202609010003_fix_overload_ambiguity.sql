-- Fix overload ambiguity introduced by 202609010001/002
-- place_order had both 6-arg and 7-arg overloads -> ambiguous for 6-arg calls
-- purge_expired_logs had both 3-arg and 5-arg -> ambiguous for 3-arg calls
-- Also allow tap_action for pgTAP tests

-- 1. Drop the old 6-arg place_order overload, keep only the 7-arg with defaults
-- Recreate the 6-arg as a thin wrapper that forwards to the 7-arg with null identity
-- to keep drop+recreate idempotent; but simplest: drop old and keep new.
-- If old still exists, drop it. The new 7-arg handles 6-arg via default.
drop function if exists place_order(text, uuid, text, jsonb, text, text);

-- Ensure the 7-arg is the only one; recreate grant
grant execute on function place_order(text, uuid, text, jsonb, text, text, text) to anon, authenticated;

-- 2. Drop old 3-arg purge overload, keep 5-arg with defaults
drop function if exists purge_expired_logs(integer, integer, integer);
grant execute on function purge_expired_logs(integer, integer, integer, integer, integer) to service_role;

-- 3. Re-allow tap_action for tests by recreating check_rate_limit with broader allowlist
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
  -- Allowlist: include tap_action for pgTAP and all prod buckets
  v_allowed := p_action in (
    'auth_magic', 'auth_password', 'auth_signup',
    'admin_login', 'admin_mfa',
    'coupon_apply', 'suggest', 'export_audit', 'export_orders',
    'place_order', 'tap_action'
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

revoke all on function check_rate_limit(text, text, integer, integer) from public;
grant execute on function check_rate_limit(text, text, integer, integer) to anon, authenticated;
