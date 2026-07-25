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
    <section aria-labelledby="products-heading" className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Catalog</p>
          <h1 id="products-heading" className="text-(length:--text-3xl) font-semibold tracking-tight">
            Sản phẩm
          </h1>
          <p className="text-(length:--text-sm) text-fg-muted" aria-live="polite">
            {result.total > 0
              ? `${result.total} thiết bị · trang ${result.page}/${result.pageCount}`
              : 'Không có sản phẩm phù hợp'}
          </p>
        </div>
        <Suspense fallback={null}>
          <CatalogSort value={normalized.sort} />
        </Suspense>
      </div>

      {hasResults ? (
        <ProductGrid products={result.products} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-(--radius-xl) border border-dashed border-border-strong bg-surface-muted/80 px-6 py-16 text-center">
          <p className="text-(length:--text-lg) font-semibold text-fg">
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
