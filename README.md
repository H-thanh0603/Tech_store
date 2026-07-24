# Tech_store

Modern tech retail storefront built on Next.js App Router (strict TypeScript), Tailwind CSS v4, and local Supabase Postgres. Catalog reads run in Server Components against RLS-protected tables.

## Setup

1. Install dependencies: `npm ci`
2. Copy env placeholders: `cp .env.example .env.local`
3. Start Docker Desktop, then `supabase start` and paste the printed `API_URL` / `anon key` into `.env.local`.
4. `npm run dev`

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — build app for production
- `npm run start` — start production server
- `npm run lint` — run ESLint
- `npm run type-check` — run TypeScript check
- `npm test -- tests/smoke/app-shell.test.ts` — run smoke test
- `npm run test:e2e` — placeholder e2e script

## Local Supabase

Requires Docker Desktop running and the Supabase CLI installed.

- `supabase start` — start the local Supabase stack (Postgres, API, Studio)
- `supabase db reset` — recreate the database, apply migrations, and load `supabase/seed.sql`
- `supabase test db` — run the pgTAP catalog tests in `supabase/tests/`
- `supabase stop` — stop the local stack

Catalog schema lives in `supabase/migrations/`, deterministic seed data in `supabase/seed.sql`. RLS is enabled on every catalog table; `anon`/`authenticated` can read only published, non-archived rows. Never commit `.env` files or the local service-role key.

## Quality gate

CI (`.github/workflows/ci.yml`) runs two jobs on push/PR to `main`:

- **app** — `npm ci`, `npm run lint`, `npm run type-check`, `npm test -- --run`, `npm run build`
- **database** — starts Supabase, applies migrations + seed, runs `supabase test db` (pgTAP)

Run the full local gate before pushing:

```bash
npm run lint && npm run type-check && npm test -- --run && supabase db reset && supabase test db && npm run build
```
