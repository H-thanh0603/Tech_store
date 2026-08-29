# Free-tier hardening runbook

Checklist for running the storefront on Vercel Hobby + Supabase free + Resend
free without burning the project. Code-side hardening is committed to the
repo; this file lists the manual steps that only the project owner can do.

## Already wired in the repo

- `/api/health?check=db` probes live Supabase and returns 503 when paused.
  See `app/api/health/route.ts`.
- Monitor workflow (`.github/workflows/monitor.yml`) pings the DB probe every
  15 minutes, runs the cron self-check, and does weekly backup + restore
  proof. Required secrets: `PROD_BASE_URL`, `SUPABASE_DB_URL`, `CRON_SECRET`.
- `/api/cron/health` runs every scheduled task inline so a broken Vercel
  Cron is caught by CI. See `app/api/cron/health/route.ts`.
- Sentry client/edge/server configs are in place; supply `SENTRY_DSN` and
  the org/project slugs to activate.
- CSP, RLS, audit log, MFA, idempotent checkout, GDPR export already
  shipped (see `docs/BAO_CAO_VAN_DE_CAN_XU_LY.md` for the prior audit and
  its fixes).

## One-time setup, do these before opening the storefront to real buyers

### 1. Custom domain + HTTPS (~$10/yr)

Vercel Hobby supports custom domains with free auto-issued TLS.

- Buy a domain (Namecheap / Cloudflare Registrar / TENTEN...).
- Vercel → Project → Settings → Domains → add the apex + `www`.
- Point the domain's DNS to Vercel per the instructions shown.
- After TLS is issued, set `NEXT_PUBLIC_SITE_URL` in Vercel env to
  `https://your-domain` and redeploy so sitemap, OpenGraph, and JSON-LD
  pick it up.
- Update VNPay return URL: `https://your-domain/checkout/return` and the
  IPN URL configured at the merchant dashboard.

### 2. Supabase: verify production project

- Create a free project at supabase.com (region close to Vercel region,
  currently `sin1` per `vercel.json`).
- `supabase link --project-ref <ref>` then `supabase db push` to apply all
  migrations from `supabase/migrations/`.
- Paste `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  into Vercel env. Paste `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- Run `npm run admin:seed` once against the cloud project to bootstrap
  the first admin + TOTP secret. Save the seed output to your password
  manager; the file is git-ignored.

### 3. Resend: verify sending domain

Resend free tier only sends from `onboarding@resend.dev` to your own
address. Real order emails need a verified domain.

- Resend → Domains → Add `your-domain` → add the SPF + DKIM records
  they show you to DNS.
- Set `EMAIL_FROM=TechStore <orders@your-domain>` in Vercel env.
- Set `RESEND_API_KEY` from Resend → API Keys.

### 4. Sentry

- Create a free Sentry project (JS Next.js).
- Paste `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` into Vercel env.
- Throw one test error (visit a 500 page) and confirm it shows in the
  Sentry Issues tab.

### 5. CRON_SECRET

- Generate `openssl rand -hex 32` and set the value as `CRON_SECRET` in
  Vercel env. Also add the same value to GitHub repo secrets (Settings →
  Secrets and variables → Actions → New repository secret) so the
  monitor workflow can call `/api/cron/health`.

### 6. Branch protection + repo hygiene

- GitHub → Settings → Branches → Branch protection rules → `main`:
  require pull request + 1 approval, dismiss stale approvals, require
  linear history, do not allow force push.
- Settings → Code security and analysis: enable Dependabot alerts,
  secret scanning, push protection.
- If the repo is public, also enable "Require approval for outside
  collaborators" and "Do not allow fork PRs to run workflows without
  approval".

### 7. Two-factor on every account

- GitHub: Settings → Password and authentication → enable 2FA.
- Vercel: Account → Two-Factor Authentication.
- Supabase: Account → Security → enable 2FA.
- Resend: Workspace settings → enable 2FA.
- Sentry: enable 2FA.
- VNPay merchant portal: enable 2FA if available.

## Weekly routine (~15 min)

1. Supabase dashboard → Project is **not paused**; check usage.
2. Vercel → Deployments → latest is **Ready**, no repeated 5xx.
3. Sentry → Unresolved issues list (set up an email digest in
   Settings → Notifications).
4. GitHub Actions → `Monitor` workflow last run is green.
5. Place one test order end-to-end (cart → checkout → VNPay/VietQR/COD
   → email → admin confirm). Confirm the cron worker drains the
   outbox within 5 minutes.

## When to upgrade to paid

| Trigger | Upgrade |
| --- | --- |
| First real customer order with revenue | Vercel Pro ($20/mo) - Hobby TOS forbids commercial use |
| Supabase pauses once in a calendar month | Supabase Pro ($25/mo) - removes auto-pause, adds 7-day PITR |
| More than 50 orders/day or DB > 400 MB | Supabase Pro |
| More than 50 transactional emails/day | Resend Pro ($20/mo) |
| Want a real on-call channel | Better Stack free + Sentry free are enough for one shop |

The code does not change between free and paid tiers. Upgrading is
purely an account action; the env vars stay the same.

## What this hardening does NOT cover (by design)

- Refund / return workflow (missing from M1-M6; plan in project docs).
- E-invoice (hóa đơn điện tử) for Vietnamese tax compliance.
- Carrier integration (GHN / GHTK / Viettel Post) for shipping labels
  and tracking.
- Load testing; the free tier comfortably serves a single small store.
