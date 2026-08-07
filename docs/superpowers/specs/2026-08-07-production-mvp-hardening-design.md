# Production MVP hardening

## Goal

Make TechStore safe and operable for a small real launch without changing its
manual bank-transfer payment model. The result must preserve guest checkout
and fail open only for non-critical notifications: an order must never be lost
because email delivery is unavailable.

## Included

### Transactional email

Use Resend for four transactional emails: order received, bank-transfer
instructions, payment confirmed, and order-status changes. Resend is called
only from a protected server route; its API key is server-only.

Postgres owns delivery intent. A new `email_outbox` table receives one
idempotent event per order transition via database triggers, so creation of an
order and its email intent are atomic. The dispatcher claims a small batch,
sends with Resend, records provider message IDs, and retries transient errors
with capped exponential backoff. A failed email never rolls back an order.

A Vercel Cron route invokes the dispatcher every five minutes and requires
`Authorization: Bearer CRON_SECRET`. A manual admin-free protected invocation
is sufficient for recovery; no queue vendor or worker is added at MVP scale.

### Bot resistance

Add Cloudflare Turnstile only to high-value abuse boundaries: customer
sign-in/magic-link, checkout, and guest order tracking. The browser submits a
short-lived token. Server actions verify it with Siteverify before the
underlying mutation; Supabase Auth receives the captcha token for auth flows.
Missing configuration keeps local development and automated tests usable, but
production fails closed for these protected actions. Test keys are used in
automated tests.

### Observability and availability

Add Sentry to the Next.js client, server, and edge runtimes. Before events
leave the application, remove authorization, cookie, email, phone, address,
and raw order-code fields. Tag release, route, and a one-way order reference
only when needed for incident correlation.

Keep `/api/health` as a public liveness endpoint. Add a protected readiness
endpoint that performs a lightweight Supabase query without exposing internals.
Configure an external uptime monitor to alert on health failures; this is
operational configuration, not an application dependency.

### Security and operations

Remove production `unsafe-eval` from CSP after verification, add HSTS, and
allow only the exact Turnstile and Resend-facing origins that the browser needs
(Resend needs none). Preserve `unsafe-inline` until a nonce migration is
separately validated; it is not silently weakened or claimed secure.

Update deployment/runbook documentation to state that production admin access
requires Supabase Auth plus an active `admin_users` record. Document required
environment variables, Supabase Auth configuration (email confirmation, strong
password rule, staff MFA), key rotation, backups/PITR, Sentry PII controls,
and the recovery procedure for undelivered outbox rows.

## Explicitly excluded

- Payment provider or bank-webhook integration. Manual payment confirmation
  remains the source of truth until provider credentials and reconciliation
  requirements are supplied.
- A separate message broker, Redis queue, WAF subscription, SIEM, or
  multi-region disaster recovery. The database outbox and Vercel Cron are the
  smallest durable solution for expected MVP volume.
- Marketing email and customer-notification preferences; only transactional
  messages are sent.

## Data flow

`order insert/status update` -> `email_outbox trigger` -> `protected cron` ->
`claim row` -> `Resend` -> `sent or retry metadata`.

`protected form` -> `Turnstile verification` -> `existing validation/RPC`.

`application error` -> `Sentry scrubber` -> `Sentry`; customer PII is removed
before export.

## Failure behaviour

- Resend outage: leave the order intact, increment attempts, retry later, and
  expose the failed outbox row only to operational tooling.
- Duplicate cron invocation: row claim is atomic and the provider idempotency
  key is deterministic per outbox row.
- Turnstile outage or invalid token in production: reject the sensitive form
  with a generic retry message; all non-protected browsing remains available.
- Supabase readiness failure: health stays liveness-only while readiness and
  Sentry expose the incident without leaking database detail publicly.

## Verification

- Unit tests cover Turnstile verification, Resend error classification, cron
  authorization, PII scrubbing, and dispatcher idempotency.
- pgTAP tests cover outbox grants, RLS, trigger creation, and atomic claiming.
- E2E uses Turnstile test keys to prove checkout and tracking still work.
- CI runs lint, type-check, unit tests, production build, E2E smoke, schema
  contract checks, and pgTAP. A production checklist validates environment
  variables, admin provisioning, email domain verification, uptime alert, and
  backup policy.
