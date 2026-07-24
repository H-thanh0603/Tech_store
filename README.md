# Tech_store

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
