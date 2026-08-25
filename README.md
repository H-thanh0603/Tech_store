# TechStore

Modern tech retail storefront: Next.js App Router (strict TypeScript), Tailwind CSS v4, Supabase Postgres (RLS + RPC). Guest cart/checkout, staff admin, SEO/security polish.

## Hosting (M6)

| Layer | Platform | Why |
|-------|----------|-----|
| **App** | **Vercel** (free Hobby) | Native Next.js — not Render for the storefront |
| **Database** | **Supabase** (free project) | Same migrations as local Docker |

Details: [docs/ops/PLATFORM.md](docs/ops/PLATFORM.md) · Deploy: [docs/ops/DEPLOY.md](docs/ops/DEPLOY.md) · Runbook: [docs/ops/RUNBOOK.md](docs/ops/RUNBOOK.md) · Demo: [docs/ops/DEMO.md](docs/ops/DEMO.md)

```
Browser → Vercel (Next.js)
              ↓
         Supabase Cloud (Postgres + RLS + RPC)
```

## Local setup

1. `npm ci`
2. `cp .env.example .env.local`
3. Start Docker Desktop → `supabase start` → paste API URL / anon / service_role into `.env.local`
4. `npm run admin:seed` — tạo tài khoản admin local, TOTP test và file secret bị git-ignore
5. `npm run dev` → http://localhost:3000

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build & serve |
| `npm run lint` / `type-check` | Static checks |
| `npm test -- --run` | Unit / component tests |
| `npm run test:e2e` | Playwright smoke |
| `supabase db reset` | Local DB + seed |
| `supabase test db` | pgTAP |

## Admin

- URL: `/admin/login` — đăng nhập bằng tài khoản Supabase Auth có dòng active trong `admin_users`
- MFA: mọi Admin/Manager/Staff phải xác minh TOTP (`AAL2`) trước khi vào admin
- Local: `npm run admin:seed` (mặc định `admin@techstore.local` / `techstore-admin-e2e`, override qua `ADMIN_E2E_EMAIL` / `ADMIN_E2E_PASSWORD`)
- Service role key never goes to the browser

## Quality gate

CI (`.github/workflows/ci.yml`):

- **app** — lint, type-check, unit tests, build, Playwright chromium
- **database** — Supabase start + pgTAP

Local full gate:

```bash
npm run lint && npm run type-check && npm test -- --run && supabase db reset && supabase test db && npm run build
```

## Milestone status

| Mốc | Trạng thái |
|-----|------------|
| M1 Foundation | Done |
| M2 Browse | Done |
| M3 Buy | Done |
| M4 Operate (admin) | Done |
| M5 Polish | Done |
| M6 Launch-ready | Docs + health + Vercel config (you connect free accounts) |

## Project docs

- Blueprint: `docs/Claude_Code_TechStore_Blueprint.md`
- Specs/plans: `docs/superpowers/`
