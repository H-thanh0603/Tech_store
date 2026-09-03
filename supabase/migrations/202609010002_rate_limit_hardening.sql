-- Harden check_rate_limit: allowlist actions to prevent bucket bloat / abuse
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
  -- Allowlist: only known server-side buckets may be created via this RPC.
  -- Prevents anonymous callers from bloating request_rate_limits with arbitrary action names.
  v_allowed := p_action in (
    'auth_magic', 'auth_password', 'auth_signup',
    'admin_login', 'admin_mfa',
    'coupon_apply', 'suggest', 'export_audit', 'export_orders',
    'place_order'
  );
  if not v_allowed then
    return true; -- block unknown actions
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

-- keep grant for server-side anon usage (customer auth, coupon, suggest) but now allowlisted
revoke all on function check_rate_limit(text, text, integer, integer) from public;
grant execute on function check_rate_limit(text, text, integer, integer) to anon, authenticated;
