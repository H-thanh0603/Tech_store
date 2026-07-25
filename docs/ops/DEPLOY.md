# Deploy TechStore (M6) — Vercel + Supabase free tier

## Platform choice

| Component | Platform | Free tier |
|-----------|----------|-----------|
| Next.js storefront + admin | **[Vercel](https://vercel.com)** | Hobby |
| Postgres + Auth APIs + RPC | **[Supabase](https://supabase.com)** | Free project |

**Why not Render for the app?**  
TechStore is Next.js App Router (Server Components, Middleware, `next/image`). Vercel is the path of least friction: native framework detection, preview deploys per PR, env UI, and no Docker image to maintain. Render is excellent for long-running workers/APIs, but is **not** used for this storefront in M6.

---

## 0. Prerequisites

- GitHub repo: `H-thanh0603/Tech_store` (or your fork)
- Accounts: Vercel + Supabase (free)
- Local CLI optional: [Supabase CLI](https://supabase.com/docs/guides/cli), Node 20+

---

## 1. Create Supabase cloud project

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pick region close to users (e.g. Singapore / Southeast Asia).
3. Save the **database password** offline (you need it for CLI link).
4. Project Settings → **API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**)

### Apply migrations + seed

**Option A — Dashboard SQL (simplest for demo)**

1. Install CLI locally: `npm i -g supabase` (or use binary).
2. From repo root:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

3. Seed demo catalog/coupons: open **SQL Editor** in dashboard, paste contents of `supabase/seed.sql`, run.

**Option B — Full reset (dev/staging only, wipes data)**

```bash
# Only if you accept wiping remote data
supabase db reset --linked
```

> Production rule: **never** edit already-applied migration files. Always add a new migration.

### Verify cloud DB

- Table Editor: `products`, `orders`, `coupons` exist.
- Run a published product query or open Studio and confirm seed rows.

---

## 2. Deploy app on Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** this GitHub repository.
2. Framework: **Next.js** (auto-detected). Root directory: `.`
3. **Environment variables** (Production + Preview recommended):

| Name | Value | Notes |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Public; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret**, server only |
| `ADMIN_SECRET` | long random ≥ 16 chars | Staff `/admin` login |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | Update after first deploy if needed |
| `VIETQR_BANK_ID` | demo bank BIN | Optional demo |
| `VIETQR_ACCOUNT_NO` | demo account | Optional demo |
| `VIETQR_ACCOUNT_NAME` | `TECHSTORE` | Optional demo |

Generate a strong admin secret (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

4. Deploy → wait for build green.
5. Set `NEXT_PUBLIC_SITE_URL` to the production URL and **redeploy** so sitemap/OG use the correct origin.
6. Health check: open `https://<your-app>.vercel.app/api/health` → `{ "ok": true, ... }`.

### Custom domain (optional)

Vercel Project → Domains → add domain → update `NEXT_PUBLIC_SITE_URL` → redeploy.

---

## 3. Post-deploy smoke checklist

- [ ] `/` loads (header + footer)
- [ ] `/products` lists seeded items
- [ ] Product detail + add to cart
- [ ] Checkout COD creates order
- [ ] `/track-order` finds order by code + phone
- [ ] `/admin/login` with `ADMIN_SECRET` → dashboard
- [ ] `/robots.txt` and `/sitemap.xml` reachable
- [ ] `/api/health` returns 200

---

## 4. Preview deploys

Every PR gets a Vercel Preview URL. Use Preview env vars pointing at a **staging** Supabase project if you must isolate data; for class demos, Preview can share the free project (accept data noise).

---

## 5. What not to commit

- `.env`, `.env.local`, service role keys, real `ADMIN_SECRET`
- Docker Desktop / local Supabase volumes

See also: [RUNBOOK.md](./RUNBOOK.md), [DEMO.md](./DEMO.md).
