# TechStore runbook (operations + rollback)

## Roles

| Role | Access |
|------|--------|
| Customer / guest | Storefront only |
| Admin / Manager / Staff | `/admin` qua Supabase Auth + TOTP MFA |
| Platform admin | Vercel + Supabase dashboard |

Mỗi nhân viên có Staff Account riêng; role lấy từ `admin_users`, không lấy từ metadata hoặc client.

---

## Daily / demo health

1. `GET /api/health` → `ok: true`
2. Vercel → Deployments → latest **Ready**
3. Supabase → Project healthy (not paused)

Free Supabase projects **pause** after inactivity. Unpause in dashboard before demos.

---

## Common incidents

### Storefront empty products / 500 on catalog

- Check Supabase project not paused.
- Verify `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel match the project.
- Confirm migrations applied (`supabase db push`) and seed loaded.
- RLS: anon can only read published, non-archived products — seed must publish products.

### Admin login fails

- Kiểm tra user còn active trong `admin_users` và không bị ban trong Supabase Auth.
- Kiểm tra TOTP enrollment/verification đang bật trong cấu hình Supabase Auth.
- Phiên password-only chỉ được vào `/admin/mfa/setup` hoặc `/admin/mfa/verify`; dashboard yêu cầu `AAL2`.

### Lost MFA device

- Admin khác vào `/admin/settings` → **Đặt lại MFA**; factor và mọi session của tài khoản đích bị thu hồi, audit được ghi lại.
- Nếu mất MFA của admin duy nhất, xóa factor trong Supabase Dashboard → Authentication → Users, ghi incident thủ công, rồi đăng nhập và setup lại ngay.

### Cannot place order / cart errors

- Check browser console/network for 4xx from Supabase RPC.
- Service role is **not** used for guest cart; RPCs must be granted to `anon` (migrations do this).
- Stock: variant may be out of stock.

### Checkout double-submit

- `place_order` is idempotent via `idempotency_key`. Safe to retry same key.

### VietQR image broken

- Env `VIETQR_*` set; domain `img.vietqr.io` allowed in `next.config.ts` images.

---

## Secrets rotation

1. Mật khẩu nhân viên bị lộ → reset password, revoke session và kiểm tra audit log.
2. TOTP bị lộ/mất → Admin khác đặt lại MFA trong `/admin/settings`.
3. Supabase service role bị lộ → rotate key, update Vercel và redeploy. Không đặt service role trong `NEXT_PUBLIC_*`.

---

## Rollback

### App (Vercel)

1. Vercel → Project → **Deployments**.
2. Find last known-good production deployment.
3. **⋯ → Promote to Production** (instant rollback of app code/env snapshot of that deploy).
4. Or: `git revert` on `main` + push (new deploy).

### Database (Supabase)

- **Do not** `db reset` on production with real orders.
- Prefer forward-fix migration (new SQL file) to undo a bad schema change.
- If a migration is catastrophic and brand-new (no real users): restore from Supabase backup (Pro) or re-create free project and re-`db push` + seed (demo only).
- Point-in-time recovery is limited on free tier — treat free cloud as **demo**, not bank-grade DR.

### Full demo wipe (acceptable for school demos)

```bash
supabase link --project-ref <ref>
# WARNING: destructive
supabase db reset --linked
```

Then redeploy app if env project ref changed.

---

## Deploy freeze checklist (before presentation)

- [ ] Free Supabase project awake
- [ ] Latest `main` deployed on Vercel Production
- [ ] `NEXT_PUBLIC_SITE_URL` matches production URL
- [ ] Staff Account thử nghiệm đăng nhập được bằng password + TOTP
- [ ] One test order placed end-to-end in the last hour

---

## Monitoring (minimal free)

- **Monitor workflow** (`.github/workflows/monitor.yml`, cron 15 phút):
  - Ping `${PROD_BASE_URL}/api/health` + render storefront → fail = GitHub email/notification.
  - `supabase migration list` so local vs remote — phát hiện migration drift.
  - Backup tuần (thứ 2): `supabase db dump` upload artifact giữ 90 ngày, kèm **restore proof** — dump được nạp lại vào Postgres scratch và kiểm tra schema không rỗng.
  - Cần secrets: `PROD_BASE_URL`, `SUPABASE_DB_URL`.
- Vercel deployment emails / dashboard
- Supabase project status

Alert checkout/RPC error chi tiết: xem Supabase Dashboard → Logs → API (filter RPC `place_order` status != 200). Free tier không có log-based alert tự động.

### Restore thủ công khi sự cố

```bash
# Tải artifact backup mới nhất từ GitHub Actions → Monitor → backup job
gunzip -c backup.sql.gz | psql "$SUPABASE_DB_URL"
```

Chỉ restore vào DB trống hoặc sau khi xác nhận forward-fix không khả thi. Dump không chứa storage objects.

No paid APM in M6.
