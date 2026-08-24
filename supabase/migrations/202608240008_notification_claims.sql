-- Claim outbox rows atomically so overlapping cron invocations cannot send the
-- same notification. Stale claims become eligible again after ten minutes.

alter table notification_outbox
  drop constraint if exists notification_outbox_status_check;
alter table notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'skipped'));

alter table notification_outbox
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz;

drop index if exists notification_outbox_pending_idx;
create index notification_outbox_claimable_idx
  on notification_outbox (status, next_retry_at, claimed_at, queued_at)
  where status in ('pending', 'processing');

create or replace function claim_notification_outbox(
  p_limit integer,
  p_claim_token uuid
)
returns table (
  id uuid,
  type text,
  payload jsonb,
  retry_count integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as materialized (
    select n.id
    from notification_outbox n
    where (
      n.status = 'pending'
      and (n.next_retry_at is null or n.next_retry_at <= now())
    ) or (
      n.status = 'processing'
      and n.claimed_at <= now() - interval '10 minutes'
    )
    order by n.queued_at, n.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update notification_outbox n
  set status = 'processing',
      claim_token = p_claim_token,
      claimed_at = now()
  from candidates c
  where n.id = c.id
    and p_claim_token is not null
  returning n.id, n.type, n.payload, n.retry_count;
$$;

revoke all on function claim_notification_outbox(integer, uuid) from public, anon, authenticated;
grant execute on function claim_notification_outbox(integer, uuid) to service_role;
