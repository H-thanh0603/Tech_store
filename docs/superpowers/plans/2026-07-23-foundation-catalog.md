# Foundation and Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TechStore foundation and catalog milestones with local Supabase data, searchable product browsing, product detail, and compare flows.

**Architecture:** Use Next.js App Router with strict TypeScript. Keep catalog reads in Server Components and isolate browser interaction to small Client Components. Use Supabase local PostgreSQL migrations, RLS, seed data, and typed server queries; keep filter state in URL search parameters.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase CLI/PostgreSQL, Vitest, Playwright, GitHub Actions, npm.

## Global Constraints

- Supabase is local-only; do not access or modify production.
- Work directly on `main` because the user explicitly authorized it.
- Do not add auth, wishlist, cart, checkout, orders, or admin in this scope.
- Do not add a component library; use the smallest native/Tailwind implementation.
- Do not commit `.env`, secrets, service-role keys, caches, or generated build artifacts.
- Use migrations for every schema change; never edit an applied migration.
- Enable RLS; never disable it to make a feature work.
- Use Server Components for catalog reads; Client Components only for browser interaction.
- Every user-visible data flow has loading, empty, error, not-found, and disabled states where applicable.
- Run formatter, lint, type-check, tests, `supabase db reset`, build, Playwright smoke checks, secret scan, and `git diff` review before final push.

---

## Foundation Plan

### Task 1: Create Next.js project shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/error.tsx`
- Create: `app/loading.tsx`
- Create: `.gitignore`
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces npm scripts: `dev`, `build`, `start`, `lint`, `type-check`, `test`, `test:e2e`.
- Produces app root at `/` with semantic `header`, `main`, and `footer` placeholders.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/smoke/app-shell.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { appMetadata } from '@/lib/app-metadata'

describe('app shell', () => {
  it('exposes TechStore metadata', () => {
    expect(appMetadata.title).toContain('TechStore')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/app-shell.test.ts`
Expected: FAIL because `@/lib/app-metadata` does not exist.

- [ ] **Step 3: Write minimal project shell**

Create `lib/app-metadata.ts`:

```ts
export const appMetadata = {
  title: 'TechStore | Công nghệ chọn lọc',
  description: 'Cửa hàng công nghệ hiện đại, dễ chọn và dễ mua.',
} as const
```

Set `app/layout.tsx` to export `metadata` from `appMetadata`, load the global stylesheet, and render `{children}` inside `<body>`. Set `app/page.tsx` to render one `h1` and one product-scope sentence. Configure strict TypeScript, path alias `@/*`, ESLint, and the npm scripts without adding unrelated packages.

- [ ] **Step 4: Run test and type-check**

Run: `npm test -- tests/smoke/app-shell.test.ts && npm run type-check`
Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts app lib tests .gitignore .env.example README.md
git commit -m "feat: add Next.js foundation"
```

### Task 2: Configure local Supabase and database test layout

**Files:**
- Modify: `supabase/config.toml`
- Create: `supabase/migrations/202607230001_catalog.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/catalog.sql`
- Modify: `README.md`

**Interfaces:**
- Produces catalog tables and read-only RLS policies consumed by catalog queries.
- Produces repeatable command: `supabase db reset`.

- [ ] **Step 1: Write database assertions first**

Create pgTAP assertions in `supabase/tests/catalog.sql` for table existence, unique slugs/SKUs, non-negative prices, valid sale-price relation, non-negative reserved inventory, and anonymous read access only to active/published rows.

- [ ] **Step 2: Run the database test to verify the baseline fails**

Run: `supabase db reset`
Expected: FAIL or missing-table assertions because migration and seed are not present.

- [ ] **Step 3: Add the minimal migration**

Create tables `categories`, `brands`, `products`, `product_variants`, `product_images`, `inventory`, `product_specs`, and `product_use_cases` with UUID IDs, UTC timestamps, foreign keys, unique slugs/SKUs, non-negative numeric checks, archive/publish flags, indexes for slugs/foreign keys/filter fields, and a generated/search index suitable for product name/description/SKU search. Enable RLS on every table. Add `anon` and `authenticated` SELECT policies that expose only active/published catalog rows; add no browser write policy.

- [ ] **Step 4: Add repeatable edge-case seed**

Seed categories, brands, published and unpublished products, long product name, discounted and non-discounted variants, multiple variants, out-of-stock inventory, missing product image, specs, and use cases. Use fixed slugs/SKUs and `ON CONFLICT`-safe inserts so reset is deterministic.

- [ ] **Step 5: Run database verification**

Run: `supabase db reset`
Expected: migrations and seed complete successfully.

Run: `supabase test db`
Expected: all pgTAP catalog assertions PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase README.md
git commit -m "feat(db): add local catalog schema and seed"
```

### Task 3: Add Supabase server client and typed catalog primitives

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/catalog/types.ts`
- Create: `lib/catalog/queries.ts`
- Create: `tests/catalog/queries.test.ts`

**Interfaces:**
- `CatalogFilters`: `{ query?: string; category?: string; brand?: string; useCase?: string; minPrice?: number; maxPrice?: number; inStock?: boolean; sort?: 'relevance' | 'price-asc' | 'price-desc' | 'newest'; page?: number }`.
- `getProducts(filters: CatalogFilters): Promise<ProductListResult>`.
- `getProductBySlug(slug: string): Promise<ProductDetail | null>`.
- `getRelatedProducts(productId: string, categoryId: string): Promise<ProductCardData[]>`.

- [ ] **Step 1: Write failing query contract tests**

Test that filters normalize page to a positive integer, product results expose typed price/stock values, and product lookup returns `null` for unknown slug.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/catalog/queries.test.ts`
Expected: FAIL because query types/functions do not exist.

- [ ] **Step 3: Implement minimal typed queries**

Use the server Supabase client and select only published products, active categories/brands, active variants, images, specs, use cases, and inventory. Apply parameterized filters and a fixed page size. Calculate available stock as `quantity - reserved_quantity`, clamp only for display after DB constraints, and never expose database errors to the UI. Return DTOs instead of raw Supabase rows.

- [ ] **Step 4: Run tests and type-check**

Run: `npm test -- tests/catalog/queries.test.ts && npm run type-check`
Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase lib/catalog tests/catalog
 git commit -m "feat(catalog): add typed Supabase queries"
```

### Task 4: Add tokens and accessible app shell

**Files:**
- Create: `app/globals.css`
- Create: `components/ui/button.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/layout/header.tsx`
- Create: `components/layout/footer.tsx`
- Modify: `app/layout.tsx`
- Create: `tests/ui/accessibility.test.tsx`

**Interfaces:**
- `Button` supports `variant`, `disabled`, and native button props.
- `Header` accepts no fixed catalog data and renders navigation/search slot.

- [ ] **Step 1: Write failing component tests**

Assert button name/role, disabled behavior, input label association, and header landmark.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/ui/accessibility.test.tsx`
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement tokens and components**

Define CSS custom properties for spacing, colors, type scale, radius, shadow, and 150–250ms motion. Add visible `:focus-visible`, 44px minimum interactive targets, reduced-motion override, semantic landmarks, and no hard-coded page-specific styling. Keep components small and data-agnostic.

- [ ] **Step 4: Run tests and lint**

Run: `npm test -- tests/ui/accessibility.test.tsx && npm run lint && npm run type-check`
Expected: PASS with no lint/type errors.

- [ ] **Step 5: Commit**

```bash
git add app components tests/ui
 git commit -m "feat(ui): add accessible design foundation"
```

### Task 5: Add CI and verify foundation

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Add CI commands**

Run in order: `npm ci`, `npm run lint`, `npm run type-check`, `npm test -- --run`, `npm run build`. Keep Supabase local reset/test commands documented separately if CI service setup is not yet available.

- [ ] **Step 2: Run the complete local foundation gate**

Run: `npm run lint && npm run type-check && npm test -- --run && supabase db reset && supabase test db && npm run build`
Expected: every command exits 0.

- [ ] **Step 3: Review diff and secret scan**

Run: `git status --short && git diff HEAD~5..HEAD --check` and scan tracked files for `.env`, service-role keys, and token-shaped values. Expected: no secrets and no whitespace errors.

- [ ] **Step 4: Commit and push foundation**

```bash
git add .github README.md
git commit -m "ci: verify foundation checks"
git push origin main
```

---

## Catalog Plan

### Task 6: Add URL filter parser and catalog UI contracts

**Files:**
- Create: `lib/catalog/filters.ts`
- Create: `tests/catalog/filters.test.ts`
- Create: `components/catalog/product-card.tsx`
- Create: `components/catalog/filter-panel.tsx`
- Create: `components/catalog/pagination.tsx`

**Interfaces:**
- `parseCatalogFilters(params: URLSearchParams): CatalogFilters`.
- `serializeCatalogFilters(filters: CatalogFilters): string`.
- `ProductCard` accepts `ProductCardData` and renders link, image fallback, price, badges, and stock state.

- [ ] **Step 1: Write failing parser tests**

Cover empty params, repeated category/brand values, invalid numeric price/page, valid sort values, and round-trip serialization. Invalid inputs must normalize to defaults instead of throwing.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/catalog/filters.test.ts`
Expected: FAIL because parser and serializer do not exist.

- [ ] **Step 3: Implement parser and presentational components**

Use allowlists for sort and boolean parsing. Omit default values during serialization. Keep URL keys stable: `q`, `category`, `brand`, `useCase`, `minPrice`, `maxPrice`, `stock`, `sort`, `page`. Product card handles missing image and long names without layout shift.

- [ ] **Step 4: Run tests and lint**

Run: `npm test -- tests/catalog/filters.test.ts && npm run lint && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/filters.ts tests/catalog/filters.test.ts components/catalog
 git commit -m "feat(catalog): add URL filters and product cards"
```

### Task 7: Build home and browse pages

**Files:**
- Create: `app/products/page.tsx`
- Create: `app/products/error.tsx`
- Create: `app/products/loading.tsx`
- Create: `components/catalog/product-grid.tsx`
- Create: `components/catalog/filter-drawer.tsx`
- Modify: `app/page.tsx`
- Create: `tests/e2e/catalog-browse.spec.ts`

**Interfaces:**
- Browse page reads `searchParams`, calls `parseCatalogFilters`, then `getProducts`.
- Home page calls a bounded featured-product query and category query.

- [ ] **Step 1: Write failing Playwright scenarios**

Cover home headings, product grid loading, search/filter/sort URL persistence, pagination, no-results state, and error boundary rendering.

- [ ] **Step 2: Run scenarios to verify failure**

Run: `npm run test:e2e -- tests/e2e/catalog-browse.spec.ts`
Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement server-rendered pages**

Use semantic sections and stable layout boxes. Desktop renders sidebar filters; mobile renders a labeled drawer. Keep query state in links/forms so refresh/back preserve filters. Show `Skeleton`, contextual empty state with clear-filters link, and retry error state. Never embed static product data in the page.

- [ ] **Step 4: Run targeted tests**

Run: `npm run test:e2e -- tests/e2e/catalog-browse.spec.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app components tests/e2e
 git commit -m "feat(catalog): add home and product browse pages"
```

### Task 8: Build product detail and compare

**Files:**
- Create: `app/products/[slug]/page.tsx`
- Create: `app/products/[slug]/not-found.tsx`
- Create: `app/products/[slug]/loading.tsx`
- Create: `app/compare/page.tsx`
- Create: `components/catalog/product-gallery.tsx`
- Create: `components/catalog/variant-selector.tsx`
- Create: `components/catalog/spec-table.tsx`
- Create: `components/catalog/compare-table.tsx`
- Create: `tests/catalog/detail.test.ts`
- Create: `tests/e2e/catalog-detail.spec.ts`

**Interfaces:**
- `ProductGallery` accepts ordered images and renders fallback/alt text.
- `VariantSelector` accepts variants and selected variant ID, emits only an existing variant ID.
- `CompareTable` accepts 0–4 same-category `ProductDetail` records.

- [ ] **Step 1: Write failing detail/compare tests**

Unit-test unknown slug, image fallback, variant price/stock selection, and compare rejection for more than four or mixed categories. Playwright-test detail load, variant URL/state update, unavailable variant, not-found, and compare horizontal scroll.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/catalog/detail.test.ts` and `npm run test:e2e -- tests/e2e/catalog-detail.spec.ts`
Expected: FAIL because routes/components do not exist.

- [ ] **Step 3: Implement detail and compare**

Call typed queries from Server Components. Use `notFound()` for missing/unpublished products. Keep selected variant in URL `variant`; derive displayed price and stock from that variant. Disable unavailable variants. Compare accepts `ids` URL parameter, caps to four, requires a common category, highlights differing specs, and explains invalid selections. Use sticky purchase/compare headers only on desktop and horizontal scroll on mobile.

- [ ] **Step 4: Run targeted tests and build**

Run: `npm test -- tests/catalog/detail.test.ts && npm run test:e2e -- tests/e2e/catalog-detail.spec.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/products app/compare components/catalog tests/catalog/detail.test.ts tests/e2e/catalog-detail.spec.ts
 git commit -m "feat(catalog): add product detail and compare"
```

### Task 9: Final quality gate and push catalog

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: any files required by verified failures only

- [ ] **Step 1: Run complete checks**

Run: `npm run lint && npm run type-check && npm test -- --run && supabase db reset && supabase test db && npm run build && npm run test:e2e`
Expected: all commands exit 0.

- [ ] **Step 2: Run responsive and keyboard smoke checks**

Use Playwright at 375px and 1440px. Verify no horizontal overflow except intentional compare scrolling, filter drawer keyboard close/focus return, visible focus rings, image alt text, and reduced-motion CSS behavior.

- [ ] **Step 3: Review diff and secrets**

Run: `git status --short`, `git diff origin/main..HEAD --check`, and inspect all changed files. Expected: only foundation/catalog files, no `.env`, secrets, service-role keys, or generated artifacts.

- [ ] **Step 4: Commit and push catalog**

```bash
git add .github README.md
 git commit -m "test: complete foundation and catalog quality gate"
 git push origin main
```

## Self-review

- Foundation requirements map to Tasks 1–5: app shell, local Supabase, migration/seed/tests, tokens/components, CI, README, and quality gate.
- Catalog requirements map to Tasks 6–9: URL filters, home, browse, detail, variants, images, specs, inventory, related data through queries, compare, responsive states, E2E, and final verification.
- Security requirements map to Task 2 RLS and constraints, Task 3 server client/DTOs, Task 9 secret scan.
- No placeholders remain; every task has files, interfaces, test command, expected result, and commit.
- Foundation must be complete and pushed before Catalog tasks begin.
