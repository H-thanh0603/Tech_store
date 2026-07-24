# TechStore M3 Buy Design

Date: 2026-07-24
Status: Approved
Scope: M3 Buy milestone from `docs/Claude_Code_TechStore_Blueprint.md`

## Goal

Deliver guest purchasing for the local/dev storefront: a database-backed cart that survives refresh, coupon application, guest checkout, COD and bank-transfer order creation, atomic stock reservation, duplicate-submit protection, order confirmation, and guest order tracking.

This scope excludes authentication, customer accounts, staff/admin workflows, payment webhooks, shipment-carrier integration, and email delivery. Those belong to later milestones.

## Delivery shape

Split implementation into three focused slices on branch `feature/commerce-buy`, with each slice verified before the next:

1. Cart schema/RPC and cart UI.
2. Checkout, atomic order creation, confirmation, and VietQR presentation.
3. Coupon, tracking, integration tests, and full quality verification.

Use only local Supabase/dev. Do not access or modify production. Do not edit an applied migration; add a new migration.

## Architecture

- Next.js App Router with strict TypeScript.
- Server Components read cart/order data and render pages.
- Server Actions validate `FormData`, manage cookies, call Supabase RPCs, map safe errors, and revalidate affected paths.
- PostgreSQL RPCs own multi-row transactions, money calculations, coupon rules, stock locking, idempotency, and tracking lookup.
- No PostgreSQL driver. Keep Supabase JS as the only database client.
- Add `zod` as the only new dependency. Reuse schemas in Server Actions and unit tests; do not add a form/state library.
- Use native forms and React 19 `useActionState` for checkout/cart mutations and pending/error feedback.

## Guest identity and cookies

- `techstore_cart` is an opaque 32-byte random token encoded base64url.
- Store only `sha256(token)` in `carts`; never store the raw token.
- Cookie flags: `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`, max age 30 days.
- Cart token possession authorizes access to that guest cart. Server Actions never trust a client-provided cart ID.
- `techstore_order_access` is a separate opaque token for order confirmation/tracking access. Store only its SHA-256 hash on `orders`.
- On successful order creation, mark the cart `converted`; create a new cart token for future shopping.
- Order pages do not expose an order from the public code alone. Confirmation uses the access cookie; tracking requires order code plus matching phone number.

## Database schema

Add a new migration with these tables and constraints:

- `carts`: UUID, token hash unique, status (`open|converted|expired`), applied coupon ID nullable, timestamps.
- `cart_items`: UUID, cart ID, variant ID, quantity `1..99`, price-at-add, timestamps, unique `(cart_id, variant_id)`.
- `coupons`: unique uppercase code, discount type (`percentage|fixed`), non-negative value, minimum order, optional maximum discount, starts/ends timestamps, optional usage limit, active flag.
- `coupon_redemptions`: coupon ID, order ID unique, quantity/validity metadata, expiry/released timestamp as needed for transfer holds, unique `(coupon_id, order_id)`.
- `orders`: public order code unique, cart ID nullable, idempotency key unique, access-token hash unique, customer name/phone/email, address snapshot, payment method (`cod|bank_transfer`), payment status, order status, subtotal/discount/shipping/total, coupon snapshot, transfer expiry, timestamps.
- `order_items`: order ID, variant ID nullable, product-name/SKU/attributes snapshots, unit price, quantity, line total.
- `inventory_reservations`: order ID, variant ID, quantity, nullable expiry, released timestamp, timestamps; indexes by variant and active expiry.
- `request_rate_limits`: action name, hashed request identity, bucket start, attempt count; used to rate-limit add-to-cart, checkout, and guest tracking without storing raw IP, phone, code, or tokens.

Database rules:

- Store money as PostgreSQL numeric values representing whole VND; never calculate order totals with JavaScript floating point.
- Foreign keys, unique keys, non-negative checks, quantity bounds, valid enum checks, and order total checks enforce invariants.
- Orders retain snapshots and are never hard-deleted in this milestone.
- Direct anonymous table writes are revoked. RPCs are the write boundary.
- RLS is enabled on commerce tables. RPCs are `SECURITY DEFINER`, set a fixed `search_path`, and expose only required result fields.
- `catalog_products` and product detail stock reads must use active, non-expired reservations consistently with checkout availability.

## Cart data flow

1. Product detail submits variant ID and quantity to a Server Action.
2. Action validates input with Zod, gets/creates the cart cookie, hashes the token server-side, and calls `cart_add_item(token_hash, variant_id, quantity)`. Raw cart tokens never enter PostgreSQL logs or function arguments.
3. RPC verifies the variant is active and belongs to a published, non-archived product; locks its inventory row; validates available stock; upserts the cart item.
4. Cart reads return current price, price-at-add, `price_changed`, current available stock, and an `out_of_stock` flag.
5. Quantity updates repeat stock validation. Remove is idempotent.
6. Coupon selection is stored on the cart but always revalidated in checkout.
7. Empty carts redirect to `/products` from checkout.

## Atomic order transaction

`place_order` receives the server-computed cart token hash, idempotency key, customer/address/payment input, and coupon code. The RPC performs one transaction:

1. Lock the cart row.
2. If idempotency key already exists, return the existing order without creating another order.
3. Lock coupon row when present.
4. Lock all relevant inventory rows in deterministic variant-ID order.
5. Re-read published/active variants, current prices, and available stock.
6. Fail atomically on missing product, changed price, insufficient stock, invalid coupon, or empty cart.
7. Calculate subtotal, discount, shipping `0`, and total in PostgreSQL.
8. Insert order and customer/address/payment/coupon snapshots.
9. Insert order-item snapshots.
10. Insert inventory reservations. Bank transfer expires after 24 hours; COD has no expiry in M3.
11. Insert coupon redemption.
12. Mark cart converted and return order code, totals, and transfer expiry. Before calling the RPC, the Server Action generates a raw order-access token and passes only its hash for storage; after commit it sets the raw token in the httpOnly cookie.

Same idempotency key returns the same order. Concurrent requests cannot create duplicate orders or oversell stock.

## Coupon rules

- Codes normalize with trim + uppercase.
- Percentage discount: `floor(subtotal * percentage / 100)`, capped by optional maximum discount.
- Fixed discount: capped at subtotal.
- Coupon applies only when subtotal meets minimum order.
- Coupon must be active and within start/end time.
- Usage limit counts valid redemptions and is protected by a row lock in the order transaction.
- A bank-transfer order's coupon redemption follows the 24-hour reservation expiry; COD redemption remains valid until a later staff workflow releases it.
- Invalid, expired, exhausted, or below-minimum coupons return safe typed errors; no order is created.

## Checkout and payment

Required fields: customer name, Vietnamese phone number, province/city, district, ward, street address, and payment method. Email and note are optional. Native HTML constraints support UX; Zod validates on the server; database constraints protect persistence.

- COD creates `pending` order/payment status and a non-expiring stock reservation.
- Bank transfer creates `awaiting_payment` order with `payment=pending`, 24-hour stock/coupon hold, and transfer expiry.
- Shipping is always `0` in M3 and is displayed explicitly.
- VietQR dynamic URL is built server-side from validated env/config: bank ID, account number, account name, amount, and order-code transfer description. Do not include customer PII in QR content.
- No bank webhook in M3. Staff confirmation is a later admin workflow.
- If the QR image fails, confirmation still renders bank details, amount, and transfer description as text.

## Routes and UI

- `/cart`: item list, quantity controls, remove, coupon input, subtotal/discount/shipping/total, price/stock-change messages, empty state, checkout CTA.
- `/checkout`: short single-page guest form, contact/address/payment, order summary, pending state, field errors, safe transaction errors.
- `/orders/[code]/confirmation`: access-cookie protected confirmation; COD summary/status; bank-transfer QR, amount, bank details, transfer description, expiry.
- `/track-order`: code + phone form; generic failure message; rate-limited.
- `/orders/[code]`: access protected status timeline, snapshots, totals, redacted address/phone; expired transfer state.
- Product detail variant selector submits the real cart action; out-of-stock variants cannot be added.
- Header gets a cart link with server-rendered item count.
- Use native forms and accessible labels; touch targets remain at least 44px. On mobile, keep checkout summary in document flow; use a sticky summary only where it does not cover form controls.

## Error contract

Map database/application errors to stable user-facing codes:

- `CART_EMPTY`: redirect to cart/products.
- `OUT_OF_STOCK`: identify item and current available quantity.
- `PRICE_CHANGED`: show old/current price and require resubmission.
- `COUPON_INVALID`, `COUPON_EXPIRED`, `COUPON_EXHAUSTED`, `COUPON_MINIMUM`: explain correction; preserve cart.
- `IDEMPOTENT_REPLAY`: redirect to existing confirmation.
- `ORDER_NOT_FOUND`: generic tracking failure; never reveal whether code or phone was wrong.
- Internal/database failure: generic retry message; log no SQL, token, phone, address, or payment secrets.

## Security

- Generate tokens with `crypto.getRandomValues`; hash before persistence.
- Do not put service-role keys or QR secrets in client bundles.
- Server Actions authenticate cart/order ownership through server cookies and RPC checks.
- Tracking rate limit: five attempts per 15-minute bucket using hashed code/phone/IP identity; failure response stays generic.
- RPCs use fixed `search_path`; revoke broad execute/table-write privileges.
- Never log raw access/cart tokens, full phone numbers, addresses, or payment credentials.
- Validate redirect destinations and all user input at the server boundary.

## Testing

### Database integration/pgTAP

- Active published variants only.
- Cart uniqueness and quantity bounds.
- RLS blocks direct anonymous commerce writes.
- Stock lock race allows only one competing order when stock is one.
- Order re-reads current price and stores snapshots.
- Percentage/fixed/minimum/max/expiry/usage-limit coupon behavior.
- Transfer reservation expires after 24 hours; COD reservation persists.
- Same idempotency key returns one order; concurrent duplicate submits do not duplicate.
- Tracking requires both matching order code and phone; wrong input is generic and rate-limited.

### Unit and RTL

- Token generation/hash, phone/address schemas, money/coupon calculations, VietQR URL builder, status/expiry mapping, and action error mapping.
- Cart empty/full/price-change/out-of-stock states.
- Checkout validation, pending, success, and error states.
- Coupon states and confirmation COD/transfer/expired states.

### Playwright smoke

- Browse → add item → refresh → cart → COD order → confirmation.
- Bank transfer order → QR and text fallback.
- Stale price/stock error.
- Double-click checkout does not create two orders.
- Guest tracking success and generic failure.
- Mobile checkout at 375px and desktop checkout at 1440px.

## Quality gate and rollout

Run after each slice and before PR:

1. `npm run lint`
2. `npm run type-check`
3. `npm test -- --run`
4. `supabase db reset` and database tests
5. `npm run build`
6. Playwright against local Supabase data
7. Full `git diff` and secret scan

Do not access production. Do not claim M3 complete while required checks fail. Commit migration and dependent code together in focused commits; push a dedicated PR from `feature/commerce-buy`.
