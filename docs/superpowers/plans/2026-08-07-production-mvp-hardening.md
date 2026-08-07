# Production MVP Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver reliable transactional email, bot protection, scrubbed error monitoring, and production operations without changing manual payment confirmation.

**Architecture:** PostgreSQL triggers create durable email intents; a protected Vercel Cron route claims them and calls Resend. Turnstile protects only high-abuse forms and is verified on the server. Sentry uses a shared scrubber; readiness is private while liveness remains public.

**Tech Stack:** Next.js 16, TypeScript, Supabase/PostgreSQL + pgTAP, Resend, Cloudflare Turnstile, Sentry, Vercel Cron.

## Global Constraints

- Production uses RESEND_API_KEY, EMAIL_FROM, CRON_SECRET, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, and Sentry DSN values. Only the browser site key is public.
- The five-minute Vercel Cron needs a Pro plan. Hobby must use a daily schedule or an external scheduler.
- Email failures never roll back checkout or an order-status change.
- Sentry exports no raw email, phone, address, cookie, authorization value, or order code.
- No payment provider/webhook is introduced without its account credentials.

## File structure

- Create supabase/migrations/202608070001_email_outbox.sql and supabase/tests/email_outbox.sql: durable event table, triggers, atomic claim/ack functions and DB tests.
- Create lib/email/outbox.ts, lib/email/send.ts, lib/email/templates.ts, and app/api/cron/email/route.ts: dispatch and authenticated scheduling endpoint.
- Create lib/security/turnstile.ts and components/security/turnstile-field.tsx: server verification and reusable form field.
- Create lib/observability/sanitize.ts, Sentry runtime configuration files, instrumentation.ts, instrumentation-client.ts, and app/api/ready/route.ts.
- Modify existing commerce/customer actions and forms, next.config.ts, vercel.json, .env.example, CI, deployment docs, and focused tests.

---

### Task 1: Add a secure, durable database outbox

**Files:**
- Create: supabase/migrations/202608070001_email_outbox.sql
- Create: supabase/tests/email_outbox.sql

**Consumes:** orders(id, order_code, customer_email, payment_method, payment_status, order_status, total).

**Produces:** service-role-only email_outbox_claim(integer), email_outbox_mark_sent(uuid,text), and email_outbox_mark_failed(uuid,text).

- [ ] **Step 1: Write failing pgTAP coverage**

~~sql
select has_table('public', 'email_outbox', 'outbox exists');
select is(has_table_privilege('anon', 'public.email_outbox', 'SELECT'), false,
  'anon cannot read recipients');
select is(has_function_privilege('service_role',
  'public.email_outbox_claim(integer)', 'EXECUTE'), true, 'service role can claim');
select is(has_function_privilege('anon',
  'public.email_outbox_claim(integer)', 'EXECUTE'), false, 'anon cannot claim');
~~

- [ ] **Step 2: Run it and verify the red state**

Run: rtk supabase test db --file supabase/tests/email_outbox.sql

Expected: FAIL because the table and functions do not exist.

- [ ] **Step 3: Implement the minimal schema and triggers**

~~sql
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in
    ('order_received','bank_transfer_instructions','payment_confirmed','order_status_changed')),
  recipient text not null, payload jsonb not null, idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0), available_at timestamptz not null default now(),
  locked_at timestamptz, provider_message_id text, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
~~

Add AFTER INSERT and AFTER UPDATE OF payment_status, order_status triggers. Enqueue only a non-empty recipient; use deterministic keys such as order-id:payment_confirmed and order-id:order_status_changed:new-status, with ON CONFLICT DO NOTHING. Claim no more than 25 rows using FOR UPDATE SKIP LOCKED, reclaim locks older than 15 minutes, and make retry delay exponential until attempt six, when status becomes failed. Enable RLS; revoke table/RPC access from public, anon, authenticated; grant the three functions only to service_role. Every SECURITY DEFINER function fixes search_path to public, pg_temp.

- [ ] **Step 4: Test real event and retry behaviour**

~~sql
select is((select count(*) from email_outbox where event_type = 'order_received'),
  1::bigint, 'one initial email event');
select is((select count(*) from email_outbox where event_type = 'payment_confirmed'),
  1::bigint, 'paid transition creates one email event');
~~

- [ ] **Step 5: Run full DB validation**

Run: rtk supabase test db

Expected: all pgTAP suites pass.

- [ ] **Step 6: Commit**

~~bash
git add supabase/migrations/202608070001_email_outbox.sql supabase/tests/email_outbox.sql
git commit -m "feat: add durable order email outbox"
~~

### Task 2: Dispatch the outbox through Resend

**Files:**
- Modify: package.json, package-lock.json, vercel.json, .env.example
- Create: lib/email/outbox.ts, lib/email/send.ts, lib/email/templates.ts, app/api/cron/email/route.ts
- Create: tests/email/outbox.test.ts, tests/email/send.test.ts, tests/email/templates.test.ts

**Consumes:** Task 1 functions and RESEND_API_KEY, EMAIL_FROM, CRON_SECRET.

**Produces:** dispatchPendingEmails(limit: number) and an authenticated GET /api/cron/email.

- [ ] **Step 1: Write failing tests**

~~ts
it('uses the persistent outbox key for Resend', async () => {
  await sendOutboxEmail(row)
  expect(send).toHaveBeenCalledWith(expect.any(Object), { idempotencyKey: row.idempotencyKey })
})
it('rejects cron without its bearer token', async () => {
  expect((await GET(new Request('https://x/api/cron/email'))).status).toBe(401)
})
~~

- [ ] **Step 2: Run focused tests**

Run: rtk npm test -- --run tests/email

Expected: FAIL because the adapter and route do not exist.

- [ ] **Step 3: Implement without a second queue**

Install only resend. Render plain text plus escaped HTML for the four outbox events. Claim ten rows, send serially, pass each stable outbox key as Resend's idempotency key, store provider message IDs, and call the failure RPC for every thrown/returned error. Check config before claiming. Compare the cron bearer token in constant time; return only processed, sent, retried. Add a five-minute cron schedule only to a Pro Vercel deployment and document the Hobby fallback.

- [ ] **Step 4: Prove the green state**

Run: rtk npm test -- --run tests/email

Expected: PASS for templates, idempotency propagation, retry classification, and auth.

- [ ] **Step 5: Commit**

~~bash
git add package.json package-lock.json lib/email app/api/cron/email vercel.json .env.example tests/email
git commit -m "feat: deliver order emails through Resend"
~~

### Task 3: Protect only sensitive forms with Turnstile

**Files:**
- Create: lib/security/turnstile.ts, components/security/turnstile-field.tsx, tests/security/turnstile.test.ts
- Modify: lib/commerce/actions.ts, lib/customer/auth-actions.ts, checkout/tracking/account forms, next.config.ts, .env.example

**Consumes:** site key in the browser and secret key only on the server.

**Produces:** verifyTurnstile(formData: FormData): Promise<boolean>.

- [ ] **Step 1: Write red tests**

~~ts
it('rejects a missing response in production', async () => {
  await expect(verifyTurnstile(new FormData())).resolves.toBe(false)
})
it('allows missing configuration outside production', async () => {
  await expect(verifyTurnstile(new FormData())).resolves.toBe(true)
})
~~

- [ ] **Step 2: Run the focused test**

Run: rtk npm test -- --run tests/security/turnstile.test.ts

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement client/server pairing**

Load only https://challenges.cloudflare.com/turnstile/v0/api.js, populate a hidden cf-turnstile-response field, and give screen readers a retry message. Send the response to Siteverify without logging it. Fail closed in production or with partial configuration; permit absent configuration only in non-production. Call the helper after local parsing but before Supabase in checkout, tracking, magic-link, password sign-in, and sign-up. Pass the token to Supabase Auth as captchaToken; return a generic Vietnamese retry message on rejection.

- [ ] **Step 4: Tighten CSP**

Remove unsafe-eval; add exactly https://challenges.cloudflare.com to script and frame sources; add HSTS. Keep unsafe-inline until a separate validated nonce migration.

- [ ] **Step 5: Test and commit**

Run: rtk npm test -- --run tests/security tests/commerce/actions.test.ts tests/admin/auth.test.ts

Expected: PASS; development remains testable and production rejects an invalid token.

~~bash
git add lib/security components/security lib/commerce/actions.ts lib/customer/auth-actions.ts components/commerce components/account next.config.ts .env.example tests/security
git commit -m "feat: protect sensitive forms with Turnstile"
~~

### Task 4: Add scrubbed Sentry and protected readiness

**Files:**
- Modify: package.json, package-lock.json
- Create: lib/observability/sanitize.ts, instrumentation.ts, instrumentation-client.ts, sentry.server.config.ts, sentry.edge.config.ts, app/api/ready/route.ts
- Create: tests/observability/sanitize.test.ts, tests/smoke/ready.test.ts

**Consumes:** Sentry DSNs, CRON_SECRET, and the existing Supabase server client.

**Produces:** shared sanitizeEvent and authenticated GET /api/ready.

- [ ] **Step 1: Write failing tests**

~~ts
it('removes PII and secrets from an event', () => {
  expect(JSON.stringify(sanitizeEvent(eventWithEmailPhoneCookie))).not.toContain('alice@example.com')
})
it('returns 503 without database diagnostics when Supabase is unavailable', async () => {
  expect((await GET()).status).toBe(503)
})
~~

- [ ] **Step 2: Run them**

Run: rtk npm test -- --run tests/observability tests/smoke/ready.test.ts

Expected: FAIL because neither module exists.

- [ ] **Step 3: Implement the smallest Sentry setup**

Install only @sentry/nextjs. Share one beforeSend scrubber across client, server and edge: remove authorization/cookie headers, sensitive query names, email/phone/address fields and order-code patterns; disable default PII collection. Tag release and environment only. Do not add replay or profiling. Readiness requires the cron bearer token, performs a head-only products query, and returns only ok true or ok false; leave public /api/health unchanged.

- [ ] **Step 4: Validate and commit**

Run: rtk npm test -- --run tests/observability tests/smoke/ready.test.ts && rtk npm run build

Expected: PASS and build succeeds.

~~bash
git add package.json package-lock.json lib/observability instrumentation.ts instrumentation-client.ts sentry.*.config.ts app/api/ready tests/observability tests/smoke/ready.test.ts
git commit -m "feat: add private readiness and scrubbed Sentry monitoring"
~~

### Task 5: Finish deployment configuration and verify the release

**Files:**
- Modify: .env.example, docs/ops/DEPLOY.md, docs/ops/RUNBOOK.md, README.md, .github/workflows/ci.yml
- Create: tests/e2e/production-mvp.spec.ts

**Consumes:** Tasks 1 through 4 and dashboard configuration at Vercel, Supabase, Resend, Cloudflare, Sentry.

**Produces:** a deployable configuration and go-live checklist.

- [ ] **Step 1: Write failing E2E presence coverage**

~~ts
test('checkout renders a Turnstile response field', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page.locator('input[name="cf-turnstile-response"]')).toBeAttached()
})
~~

- [ ] **Step 2: Add test-safe CI configuration**

Use Cloudflare's documented always-pass keys only in CI, mock the Resend adapter, and configure a non-production Sentry DSN. Do not commit credentials.

- [ ] **Step 3: Correct docs and environment template**

Document all variables, Resend domain verification, Turnstile hostname restriction, Sentry PII behavior, Vercel Pro cron or fallback, uptime target /api/health, protected readiness, outbox recovery, key rotation, backup/PITR, Supabase email confirmation and staff MFA. Replace the production ADMIN_SECRET guide with creating a Supabase Auth user and matching active admin_users record.

- [ ] **Step 4: Run full verification**

Run: rtk npm run lint; rtk npm run type-check; rtk npm run security:check; rtk npm run schema:check; rtk npm test -- --run; rtk npm run build; rtk supabase test db; rtk npm run test:e2e -- --project=chromium

Expected: every command exits zero. If local Supabase is unavailable, start it and rerun DB/schema/E2E checks; do not call the state verified otherwise.

- [ ] **Step 5: Commit**

~~bash
git add .env.example docs/ops README.md .github/workflows/ci.yml tests/e2e/production-mvp.spec.ts
git commit -m "docs: document production MVP operations"
~~

## Self-review

Task 1 covers atomic intent, RLS and retry ownership. Task 2 covers Resend and scheduling. Task 3 covers client/server anti-bot validation and CSP. Task 4 covers error privacy and readiness. Task 5 covers deployment, CI and production verification. The plan uses stable email_outbox, CRON_SECRET, OutboxEvent, and cf-turnstile-response names throughout. It deliberately excludes payment providers and additional queue infrastructure.
