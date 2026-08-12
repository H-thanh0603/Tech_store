# CODEX FIX PLAN — TechStore Production Readiness

**Project:** TechStore  
**Purpose:** Guide Codex to repair the current MVP into a production-capable small-scale system.  
**Source basis:** Existing independent audit documents (`00-system-overview.md` → `07-issues.md`, `08-independent-review-handoff.md`, `system-audit.md`).  
**Primary rule:** Fix by dependency order. Do not perform a broad rewrite of the architecture.

---

# 1. Current assessment

The repository is currently classified as **MVP**.

The source code and fully migrated local Supabase schema are materially more complete than the current connected cloud environment.

Important current facts:

- Repository contains **26 migrations**.
- Fully migrated local schema contains **31 public tables**, with RLS enabled.
- Connected cloud Supabase currently has only **4 migration records** and **16 empty public tables**.
- Cloud is missing later checkout, tracking, customer, admin, content, and email schema/functions.
- Checkout design is already transactional and has strong foundations.
- RLS, server-side admin permission guards, pgTAP/Vitest/Playwright/CI are meaningful strengths.
- Production readiness is blocked mainly by deployment drift, inventory/reservation lifecycle, security defects, non-atomic admin operations, and operational gaps.

Do **not** redesign the whole application.

The objective is:

```text
MVP
  ↓
Production-capable for small scale
```

not:

```text
Rewrite everything
```

---

# 2. Critical rules for Codex

## DO NOT

- Do not modify production Supabase immediately.
- Do not run `supabase db push` against production before migration reconciliation is complete.
- Do not mark missing migrations as applied without proving schema equivalence.
- Do not rewrite historical migration files that may already have been applied to an environment unless there is an explicit migration-history strategy.
- Do not delete production data.
- Do not disable RLS to make features work.
- Do not expose `service_role` to the browser.
- Do not replace working transactional checkout logic with application-side multi-request logic.
- Do not remove tests to make CI pass.
- Do not silently change business rules without documenting them.
- Do not proceed to the next phase when the current phase gate is failing.

## DO

- Work on a dedicated branch.
- Prefer **forward migrations** for corrections.
- Use a disposable/staging Supabase environment first.
- Preserve existing security boundaries.
- Add regression tests for every P0/P1 defect fixed.
- Keep database invariants authoritative in PostgreSQL where concurrency matters.
- Show exact files changed after every phase.
- Run tests after every phase.
- Document assumptions and unresolved issues.

---

# 3. Required execution workflow

Perform work in the following order:

```text
PHASE 0  Baseline + Staging
   ↓
PHASE 1  Migration / Cloud Schema Reconciliation
   ↓
PHASE 2  Inventory + Reservation Correctness
   ↓
PHASE 3  Security Blockers
   ↓
PHASE 4  Order Tracking Abuse Protection
   ↓
PHASE 5  Transactional Admin Mutations
   ↓
PHASE 6  Schema / Data Integrity Hardening
   ↓
PHASE 7  Operations / Observability / Types
   ↓
PHASE 8  Full Staging Verification
   ↓
PHASE 9  Production Promotion Plan
   ↓
PHASE 10 Production Smoke Verification
```

Do not combine all phases into one uncontrolled batch.

---

# 4. PHASE 0 — Baseline and safe staging

## Goal

Create a trustworthy baseline before modifying application/database behavior.

## Tasks

1. Create a dedicated branch, for example:

```text
fix/production-readiness
```

2. Record the current ordered migration list under:

```text
supabase/migrations/
```

3. Capture the current local schema state.

4. Record current test results before changes:

- lint
- typecheck
- build
- Vitest
- pgTAP / Supabase database tests
- Playwright
- schema contract checks
- secret hygiene checks

5. Create or select a **disposable/staging Supabase project**.

6. Production Supabase must remain untouched in this phase.

7. Create:

```text
docs/fix-progress/
```

and write:

```text
00-baseline.md
```

containing:

- branch/commit
- test results
- migration count
- local table count
- cloud migration count
- cloud table count
- known P0/P1 issues

## Phase Gate

Proceed only if:

```text
baseline documented
+
staging/disposable database available
+
production unchanged
```

---

# 5. PHASE 1 — Reconcile migration history and cloud schema

## Problem

The repository/local schema and connected cloud schema are not equivalent.

Current intended schema:

```text
26 repository migrations
31 public tables
```

Current cloud state:

```text
4 migration records
16 empty public tables
```

Cloud is missing major later functionality including:

- `place_order`
- `order_track`
- customer profile/order RPCs
- `admin_users`
- admin RPCs
- content tables
- email outbox

This is the first production blocker.

---

## 5.1 Build a migration reconciliation matrix

Compare:

```text
repository migration history
vs
cloud migration history
vs
actual cloud schema
```

Create:

```text
docs/fix-progress/01-migration-reconciliation.md
```

with table:

| Repo migration | Cloud equivalent | SQL/schema already present? | Missing objects | Required action |
|---|---|---:|---|---|

Do not assume migration-name equivalence.

---

## 5.2 Prove clean bootstrap

On a completely fresh disposable database:

```text
empty DB
→ migration 1
→ migration 2
→ ...
→ migration 26
```

Requirements:

- all migrations apply successfully;
- all expected tables/functions/views/triggers exist;
- all expected RLS states exist;
- all expected grants exist.

---

## 5.3 Prove upgrade from cloud-like state

Create a disposable DB reproducing the current cloud's four-migration state as accurately as possible.

Then verify:

```text
cloud-like old schema
→ forward migration strategy
→ canonical latest schema
```

Do not repair production yet.

---

## 5.4 Verify schema contract

After upgrade, verify at minimum:

- expected 31 public application tables;
- RLS enabled as intended;
- `catalog_products`;
- `public_product_reviews`;
- commerce RPCs;
- customer RPCs;
- admin RPCs;
- email outbox RPCs;
- function ACLs;
- triggers;
- indexes;
- constraints.

Pay special attention to:

```text
SECURITY DEFINER
search_path
anon/authenticated grants
service_role-only functions
```

---

## Phase Gate

Do not continue until both work:

```text
fresh bootstrap → latest
```

and:

```text
cloud-like schema → latest
```

with tests passing.

Production must still remain unchanged.

---

# 6. PHASE 2 — Inventory and reservation correctness

Treat the following two audit issues as **one domain redesign**:

1. expired reservations can later consume stock already reallocated;
2. inventory has two unsynchronized reservation representations.

---

# 6.1 Establish one source of truth

Current conflicting representations:

```text
inventory.reserved_quantity
```

and:

```text
inventory_reservations
```

Real checkout uses `inventory_reservations`, while some product/admin views calculate:

```text
quantity - reserved_quantity
```

This can show incorrect stock.

## Required design

Prefer:

```text
inventory.quantity
+
inventory_reservations
```

as the canonical source of truth.

Create one authoritative stock calculation:

```text
available_variant_stock(...)
```

or equivalent canonical view/RPC.

All stock displays/checks must use the same model:

- product listing
- product detail
- cart
- checkout
- admin inventory
- admin product listing
- dashboard/reporting where inventory appears

If `reserved_quantity` is retained, it must be maintained transactionally and proven equivalent.

Otherwise deprecate/remove it safely via forward migration.

---

# 6.2 Fix reservation lifecycle

Required state model:

```text
ACTIVE HOLD
   ↓ paid/confirmed
CONSUMED

OR

ACTIVE HOLD
   ↓ expires
RELEASED / EXPIRED
   ↓
ORDER EXPIRED
```

Invalid state:

```text
reservation expired
+
old order can still complete
```

must become impossible.

---

# 6.3 Add scheduled expiry

Current expiry must not depend on someone visiting order tracking.

Implement a transactional expiration function, conceptually:

```text
expire_pending_orders()
```

Responsibilities:

1. select eligible expired pending orders;
2. lock rows safely;
3. mark order expired/cancelled according to chosen state model;
4. release inventory reservations;
5. release coupon reservations if applicable;
6. write status event;
7. write audit event where appropriate;
8. enqueue notification if product requirements require it.

Add a scheduled execution mechanism suitable for the existing stack.

---

# 6.4 Fix fulfillment invariant

`admin_update_order` must never hide overselling using logic equivalent to:

```sql
greatest(quantity - reservation, 0)
```

The completion path must:

```text
LOCK order
LOCK relevant inventory rows

verify reservation exists
verify reservation is still valid
verify expected quantity
verify stock invariant

consume reservation
decrement physical stock
record audit/status event
complete order
COMMIT
```

If the reservation is expired or invalid:

```text
REJECT transition
```

or explicitly attempt a new reservation under locks and reject if unavailable.

Do not silently complete the order.

---

# 6.5 Required tests

Add database-level regression/concurrency tests.

## Test A — stale reservation

```text
Inventory = 1

Order A reserves 1
A expires

Order B buys/reserves the unit

Admin tries to complete A

EXPECTED:
A completion fails
B's stock allocation remains valid
inventory never becomes logically oversold
```

## Test B — last-unit concurrency

```text
Inventory = 1

two checkout attempts concurrently

EXPECTED:
exactly one succeeds
```

## Test C — stock display consistency

For an active reservation:

```text
PDP available stock
=
catalog available stock
=
cart stock validation
=
admin available stock
```

## Test D — expiry idempotency

Running the expiry worker multiple times must not double-release stock/coupon holds.

---

## Phase Gate

Proceed only when:

- one canonical availability calculation is used;
- expired reservation cannot be completed;
- scheduled expiry exists;
- concurrency tests pass;
- stock display is consistent.

---

# 7. PHASE 3 — Security blockers

---

# 7.1 Fix stored JSON-LD XSS

Current vulnerable area:

```text
components/seo/json-ld.tsx
lib/seo/json-ld.ts
product detail page JSON-LD
```

Create one safe JSON-LD serializer.

At minimum safely escape:

```text
<
U+2028
U+2029
```

Example principle:

```text
< → \u003c
```

All JSON-LD must go through this serializer.

## Regression test

Use payload:

```text
</script><script>alert(1)</script>
```

Test that serialized output cannot terminate the surrounding script element.

Do not execute an exploit against a public live site.

---

# 7.2 Tighten CSP

After fixing serialization, reduce permissive CSP.

Current risks include:

```text
script-src 'unsafe-inline'
connect-src https:
img-src https:
```

Move toward:

- nonce/hash-based script policy;
- explicit allowed service origins;
- narrower `connect-src`;
- narrower `img-src`.

Do not break required:

- Supabase
- Sentry
- Resend-related server usage
- Turnstile
- VietQR image rendering
- Next.js runtime requirements

Document final origin allowlist.

---

# 7.3 Enforce server-only privileged modules

Modules containing/using privileged secrets must use executable server-only boundaries.

Add where appropriate:

```ts
import 'server-only'
```

especially around:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Add regression/build protection so Client Components cannot import privileged modules transitively.

---

# 7.4 Harden Turnstile verification

Do not validate only:

```text
success === true
```

Also validate returned values where applicable:

- expected hostname;
- expected action;
- trusted remote IP if reliable platform data is available.

Preserve fail-closed production behavior.

---

## Phase Gate

Required:

- JSON-LD regression exploit test passes;
- CSP meaningfully tightened;
- service-role module boundary enforced;
- Turnstile checks updated and tested.

---

# 8. PHASE 4 — Harden guest order tracking

## Problem

Current rate identity includes client-resettable cart-session state.

Deleting/resetting the cookie can create a new database rate-limit bucket.

Order codes are also sequential/predictable enough that rate-limit robustness matters.

---

# 8.1 Redesign rate-limit identity

Do not use a resettable cart cookie as the sole protection identity.

Use several independent budgets, conceptually:

```text
trusted-IP HMAC
+
order-code hash
+
phone hash
+
global endpoint budget
```

Avoid storing raw IP/phone when unnecessary.

Prefer:

```text
HMAC(server_secret, normalized identifier)
```

for persisted identities.

---

# 8.2 Preserve indistinguishable public responses

Do not reveal whether failure was caused by:

- incorrect order code;
- incorrect phone;
- nonexistent order;
- rate limiting.

Keep stable generic public responses.

---

# 8.3 Add retention

Add cleanup for:

```text
request_rate_limits
```

because fixed-window rows currently accumulate indefinitely.

Use a safe scheduled cleanup strategy.

---

# 8.4 Required tests

## Cookie reset test

```text
reach tracking limit
delete/reset cart cookie
retry

EXPECTED:
still limited
```

## Identifier isolation test

Ensure unrelated valid customers are not globally locked because another user failed.

## Generic-response test

Ensure failure mode does not leak order existence.

---

## Phase Gate

Cookie reset must not bypass the effective protection.

---

# 9. PHASE 5 — Make admin multi-table operations atomic

Do not convert all simple CRUD to RPC blindly.

Focus on operations where partial failure creates invalid domain state.

Current high-risk examples:

```text
createProduct()
upsertVariant()
replaceUseCases()
```

---

# 9.1 Product creation transaction

Create a service-role-only database RPC, conceptually:

```text
admin_create_product(...)
```

Single transaction:

```text
validate
insert product
insert default variant
insert inventory
insert optional image
write audit log
publish/change status if required
COMMIT
```

Any failure:

```text
ROLLBACK entire operation
```

---

# 9.2 Variant transaction

Conceptually:

```text
admin_upsert_variant(...)
```

Transaction:

```text
validate product ownership
insert/update variant
insert/update inventory
write audit
COMMIT
```

Must prevent:

```text
variant exists
inventory missing
```

after failure.

---

# 9.3 Use-case replacement transaction

Current pattern must not be:

```text
DELETE
network request
INSERT
```

Use one transaction:

```text
validate new complete set
delete old rows
insert replacements
audit
COMMIT
```

Insert failure must restore/retain old state by rollback.

---

# 9.4 Catalog audit logging

Add transactionally consistent audit logs for important catalog mutations:

- product create/update/archive/publish;
- category changes;
- brand changes;
- variant changes;
- inventory-affecting changes;
- image/spec/use-case mutations where relevant.

Audit record should include safely:

```text
actor user ID
action
entity type
entity ID
selected before/after values
timestamp
request/correlation ID when available
```

Never log secrets.

---

## Phase Gate

Inject a failure halfway through each multi-table operation and prove no partial state remains.

---

# 10. PHASE 6 — Data and schema integrity hardening

---

# 10.1 Remove fabricated production content from schema migrations

Current schema migration inserts:

- fabricated positive reviews;
- fake urgency / flash sales;
- generic product hotspots.

Do not continue embedding demo/business content inside schema rollout.

Use a forward migration to remove known fabricated rows safely if required.

Move demo data to explicit development/demo seed files:

```text
supabase/seed.sql
supabase/seeds/
```

Expected behavior:

```text
development/demo:
migrations + demo seed

production:
migrations only
```

Do not erase legitimate user-created production reviews when cleaning known fabricated fixtures.

---

# 10.2 Product image / variant ownership integrity

Prevent invalid relation:

```text
image.product_id = product A
image.variant_id = variant belonging to product B
```

Use one of:

- composite FK;
- database trigger;
- transactional RPC ownership validation.

Also scope image updates to the expected product.

---

# 10.3 Bound customer profile input

Add server-side Zod validation and corresponding SQL constraints for appropriate fields:

- name lengths;
- phone format/length;
- email format where stored separately;
- address lengths;
- other profile text bounds.

Keep both app boundary and DB boundary validation.

---

# 10.4 Fix review submission model

Current design is inconsistent:

```text
insert-own policy exists
but
authenticated INSERT grant absent
```

Additionally, restoring INSERT directly would risk self-publication because publication defaults are unsafe.

Define explicit product requirement.

Recommended safe model:

```text
authenticated user submits review
→ narrow RPC
→ is_published = false
→ optional purchase verification
→ moderation
→ publish
```

Consider:

- one review per user/product;
- verified-purchase rule if desired;
- rate controls;
- moderation metadata.

---

# 10.5 Add missing logical constraints

After checking/deduplicating existing data, consider appropriate constraints for:

```text
product_specs(product_id, group_name, label)
inventory_reservations(order_id, variant_id)
```

and other relations identified by audit.

Do not add uniqueness blindly if product requirements intentionally allow duplicates.

---

# 10.6 Retention consistency

Review inconsistent commerce history deletion policies.

In particular evaluate whether order-related:

```text
status events
notes
email outbox
```

should disappear on order deletion.

Prefer preserving required business/audit history.

If orders should never hard-delete after creation, enforce that explicitly.

---

## Phase Gate

Schema constraints must reflect actual intended domain invariants and regression tests must cover them.

---

# 11. PHASE 7 — Operations, observability and maintainability

---

# 11.1 Structured logging

Introduce a small consistent server logging layer.

Useful fields:

```text
requestId
action
route/function
userId/adminId when appropriate
entityId
errorCode
duration
```

Do not log:

```text
passwords
access tokens
cart raw tokens
service role keys
Turnstile secrets
full sensitive customer data
```

---

# 11.2 Request/correlation IDs

Create/propagate a correlation ID through important operations where practical:

- checkout;
- admin mutations;
- order status transition;
- cron/outbox dispatch.

Include correlation information in Sentry/logging/audit where safe.

---

# 11.3 Stable public error contract

Do not return raw Supabase/provider/database messages to users.

Map internal errors to stable public codes/messages.

Examples:

```text
AUTH_INVALID_CREDENTIALS
AUTH_EMAIL_EXISTS
PROFILE_INVALID
ORDER_NOT_FOUND
RATE_LIMITED_GENERIC
INTERNAL_ERROR
```

Send sanitized diagnostic details to logging/Sentry.

---

# 11.4 Email outbox operations

Existing transactional outbox design should be preserved.

Add missing operations:

- terminal failure logging;
- alerting;
- admin visibility or safe manual requeue;
- cron exception reporting.

Do not remove:

```text
FOR UPDATE SKIP LOCKED
provider idempotency
database outbox idempotency
```

---

# 11.5 Generate Supabase TypeScript database types

Generate types from the canonical schema.

Commit them.

Replace high-risk manual casts gradually.

Add CI freshness check, conceptually:

```text
generate DB types
git diff --exit-code
```

Schema change without updated generated types should fail CI.

---

# 11.6 Search-path hardening

For functions identified by Supabase advisor/audit:

- set explicit safe `search_path`;
- schema-qualify referenced database objects;
- preserve correct SECURITY INVOKER / SECURITY DEFINER intent.

---

# 11.7 Documentation repair

Update:

```text
docs/ops/DEPLOY.md
docs/ops/RUNBOOK.md
```

They must reflect the real production admin architecture:

```text
Supabase Auth
+
admin_users allow-list / roles
```

not outdated shared `ADMIN_SECRET` behavior.

Document:

- admin bootstrap;
- migrations;
- cron;
- required env names;
- staging promotion;
- rollback/recovery.

Never include secret values.

---

# 11.8 Performance changes only with evidence

Do not add every suggested index immediately.

Seed staging with realistic data.

Run:

```text
EXPLAIN
EXPLAIN ANALYZE
```

on relevant queries.

Candidate areas from audit:

- admin leading-wildcard product/SKU search;
- order filters/sorts;
- customer phone/name/email search;
- dashboard recent orders;
- product review newest sort;
- catalog correlated aggregates;
- search suggest endpoint;
- image ordering.

Only add indexes after demonstrating the query plan benefit.

Check and remove truly redundant indexes using a forward migration after verifying actual generated unique indexes.

---

# 12. PHASE 8 — Full staging verification

Before production promotion, all checks must run against a staging environment that resembles production.

---

# 12.1 Database

```text
☐ canonical migrations fully applied
☐ migration history reconciled
☐ expected table count
☐ RLS verified
☐ policies verified
☐ RPC ACL verified
☐ search_path verified
☐ schema contract passes
☐ pgTAP passes
```

---

# 12.2 Commerce

```text
☐ catalog browse
☐ product detail
☐ cart add/update/remove
☐ coupon
☐ checkout COD
☐ checkout bank transfer
☐ idempotent retry
☐ concurrent last-unit checkout
☐ reservation expiry
☐ expired order completion rejected
☐ stock consistent across PDP/list/cart/admin
☐ order tracking
☐ order cookie access
```

---

# 12.3 Security

```text
☐ JSON-LD XSS regression
☐ CSP validation
☐ tracking cookie-reset bypass regression
☐ RLS negative tests
☐ SECURITY DEFINER ACL tests
☐ service-role not bundled to client
☐ Turnstile expected action/hostname checks
☐ secret hygiene
```

---

# 12.4 Admin

```text
☐ Supabase admin bootstrap
☐ staff permissions
☐ manager permissions
☐ admin permissions
☐ unauthorized module access denied
☐ product transaction rollback
☐ variant transaction rollback
☐ use-case transaction rollback
☐ catalog audit log generated
☐ inventory adjustment
☐ order transitions
```

---

# 12.5 External services

Verify with real non-sensitive staging evidence:

```text
☐ Resend sender/domain
☐ test email received
☐ Turnstile widget + verify endpoint
☐ Sentry receives sanitized client event
☐ Sentry receives sanitized server event
☐ cron executes
☐ readiness endpoint works
☐ health endpoint works
☐ terminal email failure alert path works
```

---

# 12.6 Recovery

```text
☐ staging backup available
☐ restore procedure tested
☐ forward migration rollback/recovery documented
☐ production pre-deploy backup strategy defined
```

---

## Phase Gate

All P0 items must be closed.

All P1 items required for production operation must be closed or explicitly accepted with written rationale.

No production promotion if any inventory, authorization, migration, or stored-XSS regression fails.

---

# 13. PHASE 9 — Production promotion plan

Do not perform production changes until presenting the plan first.

Create:

```text
docs/fix-progress/09-production-promotion.md
```

Include:

1. exact production backup/snapshot step;
2. exact migration reconciliation action;
3. exact migration command sequence;
4. expected migration versions before/after;
5. expected table/function counts;
6. expected downtime, if any;
7. smoke tests;
8. abort conditions;
9. recovery plan.

Do not expose secret values.

The plan must be reviewable before execution.

---

# 14. PHASE 10 — Production smoke verification

After approved production migration:

Verify read-only/non-destructive checks first.

Then controlled smoke tests.

Minimum:

```text
☐ production schema version correct
☐ required RPCs exist
☐ RLS enabled
☐ catalog works
☐ admin auth works
☐ test checkout works
☐ order tracking works
☐ inventory consistency correct
☐ email cron works
☐ Sentry receives sanitized event
☐ readiness healthy
```

Document evidence.

Do not seed fabricated demo reviews/flash offers into production.

---

# 15. Issue-to-phase mapping

| Audit issue | Target phase |
|---|---:|
| Cloud schema drift / 4 of 26 migrations | Phase 1 |
| Stored JSON-LD XSS | Phase 3 |
| Broad CSP | Phase 3 |
| Expired reservation fulfillment | Phase 2 |
| Duplicate reservation models | Phase 2 |
| Fake reviews / flash urgency / hotspots in migration | Phase 6 |
| Tracking rate-limit cookie bypass | Phase 4 |
| Admin product mutations non-atomic | Phase 5 |
| Missing catalog audit trail | Phase 5 |
| Profile fields unbounded | Phase 6 |
| Product image/variant ownership | Phase 6 |
| Review write path broken/unsafe | Phase 6 |
| Rate-limit retention | Phase 4 / 7 |
| Service-role lacks server-only guard | Phase 3 |
| Fragmented logging/errors | Phase 7 |
| Stale deployment docs | Phase 7 |
| Missing generated DB types | Phase 7 |
| Mutable helper search paths | Phase 7 |
| Placeholder reports/settings | Later / P3 |
| Browser-only analytics | Later / P3 |
| Local/server customer state duplication | Later / P3 |

---

# 16. Explicitly preserve these good parts

Do not regress existing strong architecture.

Preserve:

- PostgreSQL transaction-based checkout;
- inventory row locking during order creation;
- server-authoritative pricing;
- idempotency handling;
- cart opaque-token hashing;
- RLS;
- `auth.uid()`-based customer ownership;
- server-side admin module guards;
- service-role usage only after authorization;
- atomic admin order state transition RPC;
- order status/audit events;
- transactional email outbox;
- `FOR UPDATE SKIP LOCKED`;
- provider email idempotency;
- Vitest;
- Playwright;
- pgTAP;
- schema/secret CI checks;
- Sentry PII scrubbing.

This task is a **hardening and production-readiness repair**, not a rewrite.

---

# 17. Testing rule

For every defect fixed:

```text
reproduce old failure
→ write regression test
→ implement fix
→ prove regression test passes
→ run surrounding existing tests
```

For database concurrency defects, prefer database-level tests rather than only frontend E2E tests.

For security fixes, include negative tests.

---

# 18. Commit strategy

Prefer small reviewable commits.

Suggested grouping:

```text
fix(db): reconcile migration strategy
fix(stock): unify reservation availability
fix(stock): enforce reservation expiry lifecycle
fix(security): safely serialize json-ld
fix(security): tighten csp and server boundaries
fix(security): harden order tracking throttle
fix(admin): make product mutations transactional
fix(data): isolate demo content from migrations
fix(schema): enforce relational invariants
fix(ops): structured logging and request ids
fix(types): generate supabase database types
docs(ops): update production deployment runbook
```

Do not squash everything into one opaque change before review.

---

# 19. Required report after every phase

After completing a phase, stop and provide:

```text
PHASE:
STATUS: PASS / BLOCKED

Files changed:
- ...

Migrations added:
- ...

Tests added:
- ...

Tests executed:
- ...

Results:
- ...

Issues fixed:
- ...

Remaining risks:
- ...

Production modified:
NO

Gate satisfied:
YES / NO
```

Do not automatically start the next phase if:

```text
Gate satisfied = NO
```

---

# 20. Final definition of done

The project can be considered:

```text
Production-capable for small scale
```

only when all of the following are demonstrated:

1. repository schema and cloud schema are reconciled;
2. all canonical migrations are repeatable;
3. staging can bootstrap from zero;
4. production upgrade path is proven on disposable/staging infrastructure;
5. stored JSON-LD XSS is fixed;
6. CSP is meaningfully tightened;
7. reservation has one authoritative model;
8. expired holds cannot consume reallocated stock;
9. reservation expiry occurs without user interaction;
10. guest tracking cannot reset its effective throttle by clearing a cookie;
11. important admin multi-table writes are transactional;
12. fabricated reviews/urgency are not production schema data;
13. RLS/ACL/admin authorization remain correct;
14. external Auth/Resend/Turnstile/Sentry/cron operation is verified;
15. observability can trace failed checkout/admin/email operations;
16. backup/restore is verified;
17. pgTAP, Vitest, Playwright, typecheck, lint and build pass;
18. production smoke tests pass.

---

# 21. Start instruction for Codex

Start with **PHASE 0 only**.

Do not modify production.

Before writing fixes:

1. inspect the repository;
2. verify the audit findings still match the current branch;
3. record the baseline;
4. create/update `docs/fix-progress/00-baseline.md`;
5. run the baseline test suite;
6. report the Phase 0 result.

Only proceed to Phase 1 after the Phase 0 gate passes.
