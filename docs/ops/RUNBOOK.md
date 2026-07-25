# TechStore runbook (operations + rollback)

## Roles

| Role | Access |
|------|--------|
| Customer / guest | Storefront only |
| Staff (demo) | `/admin` via `ADMIN_SECRET` |
| Platform admin | Vercel + Supabase dashboard |

There is no multi-user auth yet (M4/M6 demo secret). Rotate `ADMIN_SECRET` if leaked.

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

- `ADMIN_SECRET` env present on Vercel, min 16 characters.
- Cookie blocked? Test non-private window; `secure` cookies need HTTPS (Vercel is HTTPS).
- Middleware + page both require valid signed cookie.

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

1. Generate new `ADMIN_SECRET` → Vercel env → Redeploy → all staff re-login.
2. Supabase: rotate service_role only if leaked → update Vercel → Redeploy. Anon key rotation requires client redeploy too.
3. Never put service_role in `NEXT_PUBLIC_*`.

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
- [ ] Admin secret known only to presenters
- [ ] One test order placed end-to-end in the last hour

---

## Monitoring (minimal free)

- Vercel deployment emails / dashboard
- Supabase project status
- Optional: uptime ping on `/api/health` (UptimeRobot free)

No paid APM in M6.
