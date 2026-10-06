# Migration template (Q79/Q134) — copy thành `YYYYMMDDHHMMSS_ten_moi.sql`

Quy ước an toàn prod (expand → contract, zero-downtime):

1. **Expand trước:** chỉ `ADD COLUMN ... NULL` / `CREATE INDEX CONCURRENTLY` /
   `CREATE TABLE` mới. KHÔNG: `DROP`, `RENAME`, `ALTER TYPE`, `ADD NOT NULL`
   không default, backfill toàn bảng trong 1 transaction.
2. **Migrate code:** deploy code đọc cả cũ + mới (dual-read), ghi cả hai nếu đổi tên.
3. **Contract sau (release tiếp theo):** drop cột/bảng cũ sau khi xác nhận không còn code cũ chạy.
4. Mọi function `SECURITY DEFINER` phải có `set search_path = public, pg_temp`;
   RLS ON + revoke anon/authenticated, grant tối thiểu (xem `docs/ops/DATABASE.md:7`).
5. Bảng chứa PII mới → thêm vào `purge_expired_logs` hoặc function purge riêng + gọi từ `/api/cron/purge-logs`.
6. Chạy `supabase db lint` + `supabase test db` trước merge (CI đã gate).

```sql
-- Mô tả ngắn: ...
create table if not exists example_table (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table example_table enable row level security;
revoke all on table example_table from public, anon, authenticated;
grant select, insert on table example_table to service_role;
```
