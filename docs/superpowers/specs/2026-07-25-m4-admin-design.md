# TechStore M4 Operate (Admin) Design

Date: 2026-07-25  
Status: Approved  
Scope: M4 Operate from `docs/Claude_Code_TechStore_Blueprint.md` — Option B (full catalog CRUD + order ops)

## Goal

Deliver a local/demo **staff admin** so the store can be operated: dashboard metrics, full product catalog CRUD (product, variants, prices, stock, image URLs, publish/archive), and order list/detail with valid status and payment transitions.

## Non-goals (explicit)

- Supabase Auth / multi-staff roles / password reset
- Banner/articles CMS, coupon admin UI
- File upload storage (images are URL-only)
- Email/SMS notifications, payment webhooks
- Audit log table, bulk import, PC builder, compare, wishlist, customer accounts

## Architecture

**Approach A (approved):** Next.js Server Components + Server Actions + Zod validation + **service-role** Supabase client for catalog CRUD; **one SECURITY DEFINER RPC** for order status/payment transitions so stock release/deduction stays atomic.

| Concern | Boundary |
|---------|----------|
| Admin session | `ADMIN_SECRET` env; signed httpOnly cookie `techstore_admin` |
| Catalog writes | Server-only service-role client; never in Client Components |
| Order status / cancel / complete | PostgreSQL RPC `admin_update_order` |
| Anon key | Unchanged for storefront; no new table write grants to anon |
| Validation | Zod on every FormData field; DB constraints remain source of truth |

## Auth (local/demo)

1. `POST` login with `ADMIN_SECRET` (constant-time compare).
2. Set cookie `techstore_admin` = `base64url(exp).base64url(nonce).base64url(hmac)` where `hmac = HMAC-SHA256(ADMIN_SECRET, exp.nonce)`.
3. `requireAdminSession()` in admin layout (except `/admin/login`) and every admin action.
4. Logout clears cookie.
5. Env: `ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (local only; never `NEXT_PUBLIC_`).

## Routes

```
/admin/login
/admin                      dashboard
/admin/products             list + status filters
/admin/products/new         create product (+ initial variant/stock)
/admin/products/[id]        edit product, variants, images, specs, use cases
/admin/orders               list + status filter
/admin/orders/[code]        detail + status/payment actions
```

Admin UI uses store tokens (Precision Atelier) but denser tables/forms. Nested under root layout is acceptable for M4 (storefront chrome may still wrap).

## Catalog CRUD rules

- **Product:** name, slug (unique), category_id, brand_id optional, description, is_featured, is_published, is_archived.
- **Publish:** prefer at least one active variant (match existing catalog trigger if present).
- **No hard delete** of product/variant that appears on `order_items`; archive / deactivate instead.
- **Variant:** sku unique, attributes as simple key/value pairs, regular_price ≥ 0, sale_price null or ≤ regular, is_active.
- **Inventory:** set absolute `quantity` and `low_stock_threshold`; never edit `reserved_quantity` from UI; enforce `quantity >= reserved_quantity`.
- **Images:** url, alt_text, sort_order, optional variant_id.
- **Specs / use cases:** simple row editors on product detail.

## Order rules

Allowed `order_status` transitions:

```
pending | awaiting_payment → confirmed | cancelled | expired
confirmed → packing | cancelled
packing → shipping | cancelled
shipping → completed
completed | cancelled | expired → (terminal)
```

Payment:

- `pending` → `paid` (staff confirm)
- `paid` is terminal for payment_status
- Confirming bank transfer may also move `awaiting_payment` → `confirmed` when requested together

Inventory side-effects in RPC:

- **cancelled / expired:** set `released_at` on open reservations and coupon redemptions for that order.
- **completed:** for each unreleased reservation, decrease `inventory.quantity` by reservation qty (clamped by checks), then set `released_at`.

## Data layer files

```
lib/admin/auth.ts
lib/admin/supabase.ts
lib/admin/types.ts
lib/admin/validation.ts
lib/admin/errors.ts
lib/admin/status-rules.ts
lib/admin/queries.ts
lib/admin/product-actions.ts
lib/admin/order-actions.ts
lib/admin/auth-actions.ts
supabase/migrations/202607250009_admin_order_ops.sql
supabase/tests/admin.sql
app/admin/**
components/admin/**
tests/admin/**
```

## Testing gate

- Unit: status transition matrix, auth cookie sign/verify, product validation
- SQL: cancel releases reservation; complete deducts quantity; illegal transition rejected
- RTL smoke: login form, product form field errors
- Full gate: lint, type-check, vitest, `supabase db reset` + `supabase test db`, build
- No secrets in git

## Success criteria

Staff can log in with local secret, create a product with variant/stock/image URL, publish it, see it on storefront after refresh, list guest orders, confirm payment, advance status to completed, and cancel with stock freed.
