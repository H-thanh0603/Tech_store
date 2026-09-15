-- AI Activity Log (điểm 5): append-only log mọi tool call của assistant
-- (shopping + merchant). Đi cặp với sự kiện activity real-time trên UI.
-- identity_hash băm (không PII thô); session_key là khóa guest-safe đang dùng
-- cho customer_memories. query_sample đã redact ở tầng app (agentCall) và
-- cắt 500 ký tự ở đây. RLS bật, không policy: chỉ service_role đọc/ghi.

create table if not exists agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent text not null,
  session_key text not null,
  tool text not null,
  kind text not null default 'lookup',
  detail text not null default '',
  identity_hash text not null
);

create index if not exists agent_activity_log_session_created
  on agent_activity_log (session_key, created_at desc);

create index if not exists agent_activity_log_agent_created
  on agent_activity_log (agent, created_at desc);

alter table agent_activity_log enable row level security;
-- No policies: only service_role (assistant backend) writes; admin reads via service key.