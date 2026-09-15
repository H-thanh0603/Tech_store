create table if not exists content_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 8 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check (length(excerpt) <= 500),
  body text not null check (length(body) between 200 and 20000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  product_id uuid references products (id) on delete set null,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by_agent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_articles_status_created
  on content_articles (status, created_at desc);

alter table content_articles enable row level security;
-- No policies: only service_role (server code) reads/writes.
-- Publish chỉ qua /api/v1/assistant/articles/[id] (staff session, module content).
