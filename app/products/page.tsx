import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CatalogSort } from '@/components/commerce/catalog-sort'
import { Pagination } from '@/components/commerce/pagination'
import { ProductGrid } from '@/components/commerce/product-grid'
import { getProducts, normalizeCatalogFilters } from '@/lib/catalog/queries'
import { parseCatalogSearchParams, type RawSearchParams } from '@/lib/catalog/search-params'

export const metadata: Metadata = {
  title: 'Sản phẩm | TechStore',
  description: 'Danh sách sản phẩm công nghệ chọn lọc: laptop, điện thoại và phụ kiện.',
}

interface ProductsPageProps {
  searchParams: Promise<RawSearchParams>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const rawParams = await searchParams
  const filters = parseCatalogSearchParams(rawParams)
  const normalized = normalizeCatalogFilters(filters)
  const result = await getProducts(filters)

  const hasResults = result.products.length > 0

  return (
    <section aria-labelledby="products-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="products-heading" className="text-(length:--text-3xl) font-semibold tracking-tight">
          Sản phẩm
        </h1>
        <p className="text-(length:--text-sm) text-fg-muted" aria-live="polite">
          {result.total > 0
            ? `${result.total} sản phẩm`
            : 'Không có sản phẩm phù hợp'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div />
        <Suspense fallback={null}>
          <CatalogSort value={normalized.sort} />
        </Suspense>
      </div>

      {hasResults ? (
        <ProductGrid products={result.products} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-(--radius-lg) border border-dashed border-border bg-surface-muted px-6 py-16 text-center">
          <p className="text-(length:--text-lg) font-medium text-fg">
            Chưa tìm thấy sản phẩm nào
          </p>
          <p className="max-w-prose text-(length:--text-sm) text-fg-muted">
            Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác.
          </p>
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} filters={filters} />
    </section>
  )
}
