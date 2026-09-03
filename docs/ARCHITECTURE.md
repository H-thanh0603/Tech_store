# Architecture — boundaries & conventions

## Domain map

| Layer | Path | May import |
|---|---|---|
| Storefront UI | `app/(storefront)`, `components/{commerce,layout,home,ui}` | `lib/{catalog,commerce(public),content,customer,supabase,seo}` — **never** `lib/admin/*` (enforced by `eslint.config.mjs`) |
| Admin UI | `app/admin`, `components/admin` | `lib/admin/{auth,catalog,orders,content,coupons,dashboard,customers,shared}` barrels for new code |
| Admin kernel | `lib/admin/*` | only place allowed to use `getSupabaseAdminClient()` (service_role) |
| Commerce server | `lib/commerce/*`, `app/api/*` | may use admin client in route handlers / RPC wrappers only |

## Barrel rules

- New code imports subdomain barrels, not deep files:
  `import { listAdminProducts } from '@/lib/admin/catalog'`
  `import { EmptyState } from '@/components/ui/empty-state'`
- Old deep paths (`@/lib/admin/product-actions`, `@/lib/admin/queries`,
  `@/components/admin/ui/*`) remain as `@deprecated` re-exports — migrate opportunistically.
- Shared UI primitives live in `components/ui/*` (single source);
  `components/admin/ui/*` re-exports them.

## API versioning

- Unversioned `app/api/*` = internal (used by our own UI/cron).
- External clients must use versioned `app/api/v1/*`.
- Convention: implement once under `app/api/<name>/route.ts`, then re-export from
  `app/api/v1/<name>/route.ts` (see `app/api/v1/health/route.ts`).
- Breaking changes → add `v2`, keep `v1` until clients migrate.
