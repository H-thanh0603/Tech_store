# Security policy

## Supported versions

The `main` branch receives security fixes. Older deployments should
pin to a specific commit or run the latest release of `main`.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for suspected
vulnerabilities. Email `23130303@st.hcmuaf.edu.vn` with:

- a short description of the issue and the impact you observed,
- the exact endpoint, file, or migration that is involved,
- reproduction steps (request payload, RPC name, or SQL).

You should receive an acknowledgement within 7 days. Valid reports
are eligible for a public credit in the release notes after the fix
ships, unless you ask to remain anonymous.

## Scope

In scope for this report channel:

- Authorization bypass in Supabase RPCs, RLS policies, or admin
  guards (e.g. a guest being able to assign `user_id` on an order).
- Authentication or session handling flaws in the storefront or
  admin (e.g. cookie forgery, missing TOTP enforcement).
- Server-side request forgery, SQL injection, or template injection
  in app code or migration scripts.
- Payment flow issues in `lib/commerce/vnpay*`, `lib/commerce/vietqr*`,
  or the corresponding `order_mark_paid_by_gateway` RPC
  (e.g. amount bypass, signature bypass, replay outside the
  idempotency window).
- Inventory or pricing integrity issues
  (e.g. negative stock, double-spend across orders, coupon reuse).
- Cross-tenant data exposure in shared Supabase views or RPCs.

Out of scope:

- Denial of service via free-tier bandwidth or build minutes
  (rate-limited by the platform).
- Vulnerabilities that require physical access to a logged-in
  admin's device and their TOTP factor.
- Theoretical issues without a working proof of concept.

## What we will not do

- We will not pursue legal action against researchers who follow
  this policy, act in good faith, and avoid privacy violations,
  service disruption, and data exfiltration during testing.
- We will not publicly disclose your identity without permission.
