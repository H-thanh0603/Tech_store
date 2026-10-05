-- Q63 retention: chat memories are per-session shopping prefs, not accounts.
-- Drop rows untouched for 180 days so they cannot accumulate forever.
-- Called best-effort from /api/cron/purge-logs (a missing function there
-- must never fail the sweep).

create or replace function purge_stale_memories(p_days integer default 180)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  if p_days < 30 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Memories phải giữ ít nhất 30 ngày.');
  end if;

  delete from customer_memories
  where updated_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('code', 'OK', 'memoriesDeleted', v_deleted);
end;
$$;

revoke all on function purge_stale_memories(integer) from public;
revoke execute on function purge_stale_memories(integer) from anon, authenticated;
grant execute on function purge_stale_memories(integer) to service_role;
