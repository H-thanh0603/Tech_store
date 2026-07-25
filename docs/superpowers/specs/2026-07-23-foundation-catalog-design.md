# TechStore Foundation and Catalog Design

Date: 2026-07-23
Status: Approved
Scope: Foundation and Catalog milestones from `docs/Claude_Code_TechStore_Blueprint.md`

## Delivery shape

Use one branch, `main`, with focused commits after each verified group. Supabase stays local-only. Do not access or modify production. Do not add auth, wishlist, cart, checkout, orders, or admin in this scope.

## Architecture

- Next.js App Router with strict TypeScript.
- Tailwind CSS; no component library until a real requirement justifies one.
- Supabase local PostgreSQL/Auth/Storage setup through the CLI.
- Server Components read catalog data. Client Components handle filter drawer, variant selection, gallery, and compare interactions.
- Server-side validation at URL and data boundaries.
- `.env.example` contains local placeholders only.
- CI runs install, lint, type-check, unit tests, build, and Playwright smoke checks.

## Foundation deliverables

- Next.js application shell with TypeScript strict mode.
- Local Supabase configuration, migrations, seed data, and database test coverage.
- README setup and development commands.
- Design tokens and accessible base components.
- GitHub Actions workflow.

## Catalog deliverables

- Home page with concise hero, categories, featured products, and trust block.
- `/products` with URL-based search, category, brand, use-case, price, stock, sort, and pagination filters.
- `/products/[slug]` with gallery, price, variants, inventory, specifications, and related products.
- `/compare` with up to four products from the same category; product IDs remain in the URL.
- Loading, empty, error, not-found, missing-image, unavailable, and responsive states.

## Database model

Core tables:

- `categories`: hierarchical category data, slug, active state.
- `brands`: name, slug, logo.
- `products`: common product data, category, brand, slug, description, publish state, featured state.
- `product_variants`: unique SKU, JSONB attributes, regular and sale prices.
- `product_images`: product or variant image, ordering, alt text.
- `inventory`: quantity, reserved quantity, low-stock threshold.
- `product_specs`: group, label, value, ordering.
- `product_use_cases`: needs such as study, office, gaming, and creative work.

Database rules:

- UUID primary keys and UTC timestamps.
- Unique slugs and SKUs.
- Non-negative prices; sale price cannot exceed regular price.
- Available stock equals `quantity - reserved_quantity` and cannot be negative.
- Published products need at least one valid variant; enforce publication through a database function or transaction rather than a cross-table check constraint.
- Archive instead of hard-delete for catalog entities.
- Index slugs, foreign keys, publish/active states, featured state, price, and common filter fields.
- PostgreSQL full-text search covers product name, description, and SKU.
- RLS is enabled on catalog tables. `anon` and `authenticated` can read only published/active catalog data. Browser clients receive no write policy in this scope.
- Seed covers long names, multiple variants, out-of-stock inventory, missing images, discounted products, and non-discounted products.

## Data flow

URL search parameters are parsed and validated on the server. Invalid values normalize to safe defaults. Server queries use the Supabase server client, apply pagination and filters, and return typed DTOs to Server Components. Product-not-found and unpublished products use `notFound()`. Database/network failures map to user-facing error states without exposing database details.

## UI direction

Use modern premium technology retail styling: editorial product presentation, neutral palette with controlled electronic blue accent, generous spacing, strong typography hierarchy, and restrained motion. Use design tokens for color, spacing, radius, shadow, typography, and motion. Avoid generic dashboard grids, excessive gradients, glassmorphism, and decorative animation.

Base components:

- `Button`, `Input`, `Select`, `Checkbox`, `Badge`.
- `Container`, `SectionHeading`, `EmptyState`, `ErrorState`, `Skeleton`.
- `Header`, `SearchBox`, `MobileNavigation`, `Footer`.
- `ProductCard`, `PriceBlock`, `StockStatus`, `ProductGallery`.
- `FilterPanel`, `FilterDrawer`, `SortSelect`, `Pagination`.
- `VariantSelector`, `SpecTable`, `CompareTable`.

All primary interactions need visible focus, disabled behavior, keyboard support, and touch targets around 44px. Mobile uses a filter drawer, stacked product detail, and horizontally scrollable compare content. Respect `prefers-reduced-motion`.

## Testing and quality gate

Unit tests cover filter URL parsing/serialization, price formatting, variant selection, and available-stock calculation. Database tests cover constraints, RLS, search, filtering, and pagination. Integration tests cover catalog queries, product detail, related products, and not-found behavior. Playwright covers home loading, URL-preserving search/filter/sort, empty/error states, variant changes, compare limits, responsive smoke at 375px and 1440px, and keyboard navigation.

Before final commit, run formatter, lint, type-check, unit/integration tests, `supabase db reset`, database tests, production build, Playwright smoke checks, responsive/keyboard checks, secret scan, and full `git diff` review. Do not claim completion when a required check fails.

## Commit sequence

1. Foundation project and docs.
2. Supabase schema, RLS, seed, and database tests.
3. Design tokens and app shell.
4. Browse/search/filter catalog.
5. Product detail and compare.
6. Tests, CI, and quality fixes.

Each commit must contain only its stated group and must be pushed to `origin/main` after verification.
