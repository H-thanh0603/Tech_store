import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import {
  CatalogActiveChips,
  CatalogFiltersPanel,
} from '@/components/commerce/catalog-filters'
import { CatalogFilterDrawer } from '@/components/commerce/catalog-filter-drawer'
import { CatalogSort } from '@/components/commerce/catalog-sort'
import { Pagination } from '@/components/commerce/pagination'
import { ProductGrid } from '@/components/commerce/product-grid'
import { getCatalogFacets, getProducts, normalizeCatalogFilters } from '@/lib/catalog/queries'
import { parseCatalogSearchParams, type RawSearchParams } from '@/lib/catalog/search-params'

export const metadata: Metadata = {
  title: 'Sản phẩm | TechStore',
  description: 'Danh sách sản phẩm công nghệ chọn lọc: laptop, điện thoại và phụ kiện.',
}

// Catalog changes slowly (price/stock adjust, new products are not added
// every minute). Caching the rendered HTML for 60 s removes most of the
// DB load on shared Supabase free-tier without making the storefront
// feel stale.
export const revalidate = 60

interface ProductsPageProps {
  searchParams: Promise<RawSearchParams>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const rawParams = await searchParams
  const filters = parseCatalogSearchParams(rawParams)
  const normalized = normalizeCatalogFilters(filters)
  const [result, facets] = await Promise.all([getProducts(filters), getCatalogFacets()])

  const hasResults = result.products.length > 0
  const categoryLabel =
    facets.categories.find((c) => c.slug === filters.category)?.name ?? filters.category

  return (
    <section
      aria-labelledby="products-heading"
      className="container-store py-8 sm:py-10"
    >
      <nav aria-label="Breadcrumb" className="mb-6 text-(length:--text-sm) text-fg-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-fg">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden className="text-fg-subtle">
            /
          </li>
          <li className="font-medium text-fg" aria-current="page">
            {categoryLabel ?? 'Sản phẩm'}
          </li>
        </ol>
      </nav>

      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1
            id="products-heading"
            className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight"
          >
            {categoryLabel ? categoryLabel : 'Tất cả sản phẩm'}
          </h1>
          <p className="mt-1 max-w-xl text-(length:--text-sm) text-fg-muted">
            Lọc theo danh mục, hãng, giá và tồn kho. URL giữ state — quay lại trang vẫn đúng bộ
            lọc.
          </p>
          <p className="mt-2 text-(length:--text-sm) text-fg-muted" aria-live="polite">
            {result.total > 0
              ? `${result.total} thiết bị · trang ${result.page}/${result.pageCount}`
              : 'Không có sản phẩm phù hợp'}
          </p>
        </div>
        <Suspense fallback={null}>
          <CatalogSort value={normalized.sort} />
        </Suspense>
      </div>

      <div className="mb-5">
        <CatalogActiveChips filters={filters} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <CatalogFiltersPanel
              filters={filters}
              categories={facets.categories}
              brands={facets.brands}
              resultCount={result.total}
            />
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <CatalogFilterDrawer>
            <CatalogFiltersPanel
              filters={filters}
              categories={facets.categories}
              brands={facets.brands}
              resultCount={result.total}
            />
          </CatalogFilterDrawer>

          {hasResults ? (
            <ProductGrid products={result.products} />
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-(--radius-xl) border border-dashed border-border-strong bg-surface-muted/60 px-6 py-12">
              <p className="text-(length:--text-lg) font-semibold text-fg">
                Không tìm thấy sản phẩm phù hợp
              </p>
              <p className="max-w-prose text-(length:--text-sm) text-fg-muted">
                Thử xóa bớt bộ lọc, đổi khoảng giá, hoặc xem gợi ý theo nhu cầu.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/products"
                  className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg"
                >
                  Xóa tất cả bộ lọc
                </Link>
                <Link
                  href="/#need-selector"
                  className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border px-4 text-(length:--text-sm) font-semibold text-fg"
                >
                  Chọn theo nhu cầu
                </Link>
              </div>
            </div>
          )}

          <Pagination page={result.page} pageCount={result.pageCount} filters={filters} />
        </div>
      </div>
    </section>
  )
}
