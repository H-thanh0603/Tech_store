# TODO-GOLIVE — checklist lần chạy wizard bị lỗi và cách chạy lại đúng

Lần chạy `ops-bootstrap.sh` đầu tiên (2026-09-12) set được 6 GitHub secrets
nhưng Backup/Monitor đỏ. Nguyên nhân thật (từ log run) và cách xử lý:

| Triệu chứng | Nguyên nhân thật | Trạng thái |
|---|---|---|
| Backup: `Network is unreachable` đến `db.<ref>.supabase.co` | GitHub runners chỉ có IPv4; host direct là IPv6-only | Cần **Session pooler URL** |
| Drift check: `ECONNREFUSED` IPv6 | 同 nguyên nhân trên | Như trên |
| `SUPABASE_DB_URL` sai định dạng | Chuỗi bị dán 2 lần nối liền (`…postgrespostgresql://…`) — password chứa `@` khiến paste dễ vụn | Wizard giờ validate + chặn double-paste |
| Monitor "health 200" nhưng vẫn đỏ | `PROD_BASE_URL=https://vercel.com/thanh-5b44` là **URL dashboard**, trả 200 vì trang login Vercel — không phải app | Chưa tồn tại deployment TechStore; cần deploy trước |
| Cron self-check: 200 rồi vẫn đỏ bước sau | drift check đỏ kéo cả job | Hết khi DB URL đúng |

Đã dọn: 2 secrets sai (`SUPABASE_DB_URL`, `PROD_BASE_URL`) đã **xóa khỏi
GitHub**; giá trị còn hợp lệ giữ ở `.env.ops-wizard` (git-ignored) — chạy
lại wizard không phải nhập lại Telegram/service key.

## Việc bạn phải làm theo thứ tự (tổng ~45 phút)

### 1. Áp migrations lên DB cloud (~10 phút, chưa cần Vercel)

DB cloud đang **thiếu hầu hết migrations** (chỉ có bảng cart + vài RPC đầu;
`place_order`, `check_rate_limit`… chưa tồn tại). Tại repo root:

```bash
npx supabase login
npx supabase link --project-ref sdrdzerdasxbxdbxykso
npx supabase db push
```

`db push` sẽ áp toàn bộ migrations còn thiếu (kể cả
`202609120001_agent_rate_limit_buckets`). Xem danh sách trước nếu muốn:
`npx supabase migration list --linked` (sau khi link).

### 2. Deploy app lên Vercel lần đầu (~15 phút)

Theo `docs/ops/DEPLOY.md` §2: vercel.com/new → import repo → thêm env
Production (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` = giá trị trong
`.env.ops-wizard`, `NEXT_PUBLIC_SITE_URL` = URL app sau khi deploy xong).
Deploy xong mở `https://<app>.vercel.app/api/health` phải thấy JSON
`"service":"techstore"`.

### 3. Lấy Session pooler URL (~2 phút)

Supabase dashboard → project → nút **Connect** → mục **Session pooler** →
tab **URI** → nhập database password → copy. Chuỗi đúng dạng:

```
postgresql://postgres.sdrdzerdasxbxdbxykso:<pw>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

(không phải `db.<ref>.supabase.co` — host đó IPv6-only, GitHub không nối nổi)

### 4. Chạy lại wizard (~15 phút)

```bash
./scripts/ops-bootstrap.sh
```

Enter giữ giá trị cũ cho các secrets đã đúng; wizard sẽ hỏi lại đúng chỗ:
- Stage 2: dán **pooler URL** (wizard giờ validate định dạng + double-paste)
- Stage 5: dán **URL app Vercel** (wizard curl `/api/health` xác nhận là
  TechStore thật mới chấp nhận)

Kết thúc Stage 7–8 wizard trigger Backup + Monitor thật. Cả hai xanh là
backup pipeline đã được chứng minh end-to-end.

## Sau khi xong (không bắt buộc ngay)

- **Đổi database password Supabase**: password DB từng nằm trong `.env`
  (wizard cũ ghi nhầm vị trí). Về nguyên tắc một secret đã được ghi ra đĩa
  là nên coi như đã lộ. Dashboard → Settings → Database → Reset password,
  sau đó lấy lại pooler URI mới và update secret `SUPABASE_DB_URL`
  (`gh secret set SUPABASE_DB_URL`).
- Stage 9 wizard in checklist tài khoản (domain/Cloudflare, VNPay thật,
  2FA, branch protection) — chi tiết ở `docs/ops/BACKLOG.md` §E.
