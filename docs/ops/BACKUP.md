# Backup & Restore — TechStore

- Workflow `backup.yml` cron `0 3 * * *` (daily): `pg_dump --role-only + full → gzip → AES-256-CBC (BACKUP_PASSPHRASE) → Storage backups/ → artifact 30d → restore vào Postgres:15 scratch + count tables + so row-count products/orders/customers/reviews → prune >30d`.
- RPO 1 ngày. PITR point-in-time vẫn cần paid plan Supabase (chưa bật) — chấp nhận bằng văn bản ở AUDIT_REPORT H8.
- Không backup Storage objects (ảnh sản phẩm) — xem `RUNBOOK.md:126`. Ảnh gốc nằm ở nhà cung cấp + có thể re-upload; khôi phục bằng re-upload qua trang quản trị.
- Restore mã hóa: tải `db-YYYY-MM-DD.sql.gz.enc` → `openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in f.enc | gunzip -c | psql`, rồi `supabase db push` để chắc schema mới nhất, verify `/api/health?check=db`.
- BACKUP_PASSPHRASE lưu trong GitHub Secrets + password manager (không trong repo). Không passphrase → job vẫn chạy nhưng warn (không mã hóa).
- Staging DB không backup.
