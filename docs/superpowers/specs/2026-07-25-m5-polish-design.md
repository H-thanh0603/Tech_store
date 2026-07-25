# TechStore M5 Polish Design

Date: 2026-07-25  
Status: Approved (execute with M4 merge)  
Scope: M5 Polish — responsive / a11y / SEO / performance / security / E2E smoke

## Goal

Raise storefront + admin to launch-quality checklist: crawlable SEO, basic structured data, security headers, admin route hardening, image remote config, stronger a11y tests, and Playwright smoke for critical routes.

## In scope

1. **SEO** — `robots.ts`, `sitemap.ts`, richer root/product metadata (Open Graph), Product + Breadcrumb JSON-LD on PDP.
2. **Security** — Next.js security headers; middleware guard for `/admin/*` (except login); document env secrets.
3. **Performance** — `images.remotePatterns` for placehold.co + img.vietqr.io; prefer `sizes`/lazy where applicable.
4. **A11y** — aria-current on admin nav active link; expanded a11y unit tests; focus-visible already in tokens.
5. **E2E** — Playwright smoke: home, products, cart, admin login gate; CI job optional/light.
6. **Docs** — README quality checklist + design note.

## Out of scope

- Full Lighthouse CI budget gates
- Customer auth / account (later)
- Production deploy (M6)
- Visual regression suite

## Success

- Unit + existing SQL still pass
- Playwright smoke green against `next start` (or dev) without DB for static shells; product list may need Supabase — smoke uses routes that degrade gracefully or only checks HTTP + landmarks
- PR merges cleanly
