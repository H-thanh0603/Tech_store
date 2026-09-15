-- Order risk engine (điểm 7 — Agentic Order Processing + điểm 8 — Fraud flags).
-- Đánh giá rủi ro lưu kèm đơn; quyết định cuối luôn là con người:
--   - Đơn high-risk KHÔNG được auto-process (app dùng risk_reviews để theo dõi).
--   - Mỗi quyết định xử lý/đổi trạng thái vẫn đi qua order-actions + audit log.
-- Cột review tóm tắt kết quả chấm điểm gần nhất (engine Allstring ở app layer).

alter table orders
  add column if not exists risk_level text,
  add column if not exists risk_score integer,
  add column if not exists risk_reviewed_at timestamptz;

-- Nhật ký quyết định rủi ro: AI gắn nhãn (assessed) + nhân viên chốt (cleared/
-- held). Append-only, không update/xóa — phục vụ audit và phát hiện bất thường.
create table if not exists order_risk_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  order_code text not null,
  action text not null check (action in ('assessed', 'cleared', 'held')),
  risk_level text,
  risk_score integer,
  factors jsonb not null default '[]'::jsonb,
  actor text not null default 'shopping-agent',
  actor_user_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists order_risk_reviews_order_created
  on order_risk_reviews (order_id, created_at desc);
create index if not exists order_risk_reviews_level_created
  on order_risk_reviews (risk_level, created_at desc);

alter table order_risk_reviews enable row level security;
-- No policies: only service_role (assistant backend / order actions) writes.

comment on column orders.risk_level is 'Mức rủi ro gần nhất do risk engine gắn (low/medium/high) — không phải quyết định xử lý.';
