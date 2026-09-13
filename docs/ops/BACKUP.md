# Backup & Restore — TechStore

- Workflow `backup.yml` cron `0 3 * * 1`: `pg_dump --role-only + full → gzip → Storage backups/ → artifact 90d → restore vào Postgres:15 scratch + count tables + so row-count products/orders/customers/reviews → prune >90d`.
- RPO hiện tại 7 ngày (weekly). Muốn RPO 1d: đổi cron thành daily khi lên paid plan + có PITR.
- Không backup Storage objects (ảnh sản phẩm) — xem `RUNBOOK.md:126`.
- Restore: tải artifact/gỡ từ Storage, `pg_restore` vào project mới, chạy `supabase db push` để chắc schema mới nhất, verify `/api/health?check=db`.
- Staging DB không backup.
