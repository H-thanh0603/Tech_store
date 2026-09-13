# Staging — tách preview khỏi DB production (OPS-003)

## Vấn đề

Vercel Preview deployment (mỗi pull request) hiện trỏ vào **cùng một Supabase
project đang phục vụ khách thật**. Ai mở PR và bấm vào preview link rồi test
checkout / duyệt trả hàng / chỉnh tồn kho, mọi ghi rơi thẳng vào database
production — đơn giả, tồn kho sai, khách thật nhận email.

## Hai lớp bảo vệ

### Lớp 1 — Guard chỉ-đọc (đã có trong code)

`proxy.ts` chặn mọi request ghi (POST/PUT/PATCH/DELETE) khi
`VERCEL_ENV=preview`, trừ khi đặt `ALLOW_PREVIEW_WRITES=1` ở env preview.
Preview sau đó chỉ dùng được để **xem** UI với data thật — đủ review layout,
không thể ghi. Test: `tests/security/preview-guard.test.ts`.

Muốn tạm test ghi trên một preview cụ thể: Vercel dashboard → Project →
Settings → Environment Variables → thêm `ALLOW_PREVIEW_WRITES` = `1` cho
**Preview** scope → redeploy PR đó. Nhớ xoá sau khi test.

### Lớp 2 — Supabase project riêng cho staging (làm khi có người cộng tác)

Guard chỉ là vòng đai; đúng nghĩa staging cần data riêng:

1. **Tạo project Supabase thứ 2**: supabase.com/dashboard → New project →
   đặt tên `techstore-staging` → cùng region với prod (sin1).
2. **Apply schema**: từ repo root:

   ```bash
   supabase login
   supabase link --project-ref <STAGING_REF>
   supabase db push
   ```

   Seed demo nếu muốn có data để nhìn: SQL Editor chạy `supabase/seed.sql`.

3. **Tạo Vercel env scope Preview**: Project → Settings → Environment
   Variables, thêm cho scope **Preview** (không đè Production):

   | Biến | Giá trị |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL project staging |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key staging |
   | `SUPABASE_SERVICE_ROLE_KEY` | service key staging |
   | `CRON_SECRET` | giá trị khác prod (không dùng chung) |
   | `ALLOW_PREVIEW_WRITES` | `1` — preview được ghi tự do vào staging DB |

   Giữ nguyên biến của Production scope trỏ tới project prod.

4. **Verify**: mở preview deployment của một PR bất kỳ → thêm hàng vào giỏ →
   checkout → đơn phải xuất hiện trong **staging** project, không thấy trong
   prod. Vào `/api/health?check=db` của preview xem latency — nó đang query
   project staging.

5. **Vercel Hobby lưu ý**: mỗi project chỉ được 2 cron schedule (giữ
   `0 6` health + `0 18` purge-logs như trong `vercel.json`). Preview thừa hưởng cron
   config — không thêm cron mới cho đến khi nâng Pro plan.

## Khi nào cần làm lớp 2?

- Có người khác ngoài bạn cộng tác / mở PR thường xuyên → làm ngay.
- Chỉ một mình bạn dev, PR tự review → lớp 1 (guard) là đủ; làm lớp 2 khi
  rảnh hoặc trước khi mời cộng sự đầu tiên.

## Checklist deploy sau khi có staging

- [ ] Prod env ở Vercel trỏ Supabase prod, Preview env trỏ staging.
- [ ] `CRON_SECRET` khác nhau giữa prod và staging (guard `monitor.yml` chỉ
      ping prod qua `PROD_BASE_URL`, không đụng staging).
- [ ] Workflow Backup chỉ dump prod (`SUPABASE_DB_URL` là chuỗi prod) —
      staging DB không cần backup.
- [ ] Xoá `ALLOW_PREVIEW_WRITES` khỏi **Production** env nếu từng đặt nhầm.
