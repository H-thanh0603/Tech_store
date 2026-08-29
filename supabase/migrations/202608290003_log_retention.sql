-- Retention for append-only tables that would otherwise grow forever on
-- the 500 MB free-tier database: admin_audit_logs, analytics_events, and
-- request_rate_limits.

-- Single SECURITY DEFINER function so the cron route can call it with the
-- service role; retention defaults are tuned for a small store.

create or replace function purge_expired_logs(
  p_audit_days integer default 180,
  p_analytics_days integer default 90,
  p_rate_limit_days integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_audit_deleted int;
  v_analytics_deleted int;
  v_rate_deleted int;
begin
  if p_audit_days < 30 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Audit log phải giữ ít nhất 30 ngày.');
  end if;
  if p_analytics_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Analytics phải giữ ít nhất 7 ngày.');
  end if;
  if p_rate_limit_days < 1 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Rate limit phải giữ ít nhất 1 ngày.');
  end if;

  delete from admin_audit_logs
  where created_at < now() - (p_audit_days || ' days')::interval;
  get diagnostics v_audit_deleted = row_count;

  delete from analytics_events
  where created_at < now() - (p_analytics_days || ' days')::interval;
  get diagnostics v_analytics_deleted = row_count;

  delete from request_rate_limits
  where bucket_started_at < now() - (p_rate_limit_days || ' days')::interval;
  get diagnostics v_rate_deleted = row_count;

  return jsonb_build_object(
    'code', 'OK',
    'auditDeleted', v_audit_deleted,
    'analyticsDeleted', v_analytics_deleted,
    'rateLimitDeleted', v_rate_deleted
  );
end;
$$;

revoke execute on function purge_expired_logs(integer, integer, integer) from public, anon, authenticated;
grant execute on function purge_expired_logs(integer, integer, integer) to service_role;
