import Link from 'next/link'

import { buildCatalogQuery } from '@/lib/catalog/search-params'
import type { CatalogFilters } from '@/lib/catalog/types'
import type { CatalogFacetOption } from '@/lib/catalog/queries'

type CatalogFiltersProps = {
  filters: CatalogFilters
  categories: CatalogFacetOption[]
  brands: CatalogFacetOption[]
  resultCount: number
}

function activeChips(filters: CatalogFilters): Array<{ key: string; label: string; href: string }> {
  const chips: Array<{ key: string; label: string; href: string }> = []
  const base = { ...filters, page: 1 }

  if (filters.query) {
    chips.push({
      key: 'q',
      label: `“${filters.query}”`,
      href: `/products${buildCatalogQuery({ ...base, query: undefined })}`,
    })
  }
  if (filters.category) {
    chips.push({
      key: 'category',
      label: `Danh mục: ${filters.category}`,
      href: `/products${buildCatalogQuery({ ...base, category: undefined })}`,
    })
  }
  if (filters.brand) {
    chips.push({
      key: 'brand',
      label: `Hãng: ${filters.brand}`,
      href: `/products${buildCatalogQuery({ ...base, brand: undefined })}`,
    })
  }
  if (filters.useCase) {
    chips.push({
      key: 'useCase',
      label: `Nhu cầu: ${filters.useCase}`,
      href: `/products${buildCatalogQuery({ ...base, useCase: undefined })}`,
    })
  }
  if (filters.inStock) {
    chips.push({
      key: 'inStock',
      label: 'Còn hàng',
      href: `/products${buildCatalogQuery({ ...base, inStock: false })}`,
    })
  }
  if (filters.minPrice != null) {
    chips.push({
      key: 'minPrice',
      label: `Từ ${filters.minPrice.toLocaleString('vi-VN')}₫`,
      href: `/products${buildCatalogQuery({ ...base, minPrice: undefined })}`,
    })
  }
  if (filters.maxPrice != null) {
    chips.push({
      key: 'maxPrice',
      label: `Đến ${filters.maxPrice.toLocaleString('vi-VN')}₫`,
      href: `/products${buildCatalogQuery({ ...base, maxPrice: undefined })}`,
    })
  }
  return chips
}

export function CatalogActiveChips({ filters }: { filters: CatalogFilters }) {
  const chips = activeChips(filters)
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
        Đang lọc
      </span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 text-(length:--text-xs) font-medium text-fg hover:border-border-strong"
        >
          {chip.label}
          <span aria-hidden className="text-fg-subtle">
            ×
          </span>
          <span className="sr-only">Xóa bộ lọc {chip.label}</span>
        </Link>
      ))}
      <Link
        href="/products"
        className="text-(length:--text-xs) font-semibold text-brand hover:text-brand-hover"
      >
        Xóa tất cả
      </Link>
    </div>
  )
}

export function CatalogFiltersPanel({
  filters,
  categories,
  brands,
  resultCount,
}: CatalogFiltersProps) {
  return (
    <form
      method="get"
      action="/products"
      className="space-y-5 rounded-(--radius-lg) border border-border bg-bg-elevated p-4 shadow-(--shadow-sm)"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-(length:--text-sm) font-semibold text-fg">Bộ lọc</h2>
        <span className="text-(length:--text-xs) text-fg-muted">{resultCount} kết quả</span>
      </div>

      <div>
        <label htmlFor="filter-q" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Tìm kiếm
        </label>
        <input
          id="filter-q"
          name="q"
          defaultValue={filters.query ?? ''}
          placeholder="Tên sản phẩm…"
          className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
        />
      </div>

      <div>
        <label htmlFor="filter-category" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Danh mục
        </label>
        <select
          id="filter-category"
          name="category"
          defaultValue={filters.category ?? ''}
          className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
        >
          <option value="">Tất cả</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-brand" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Thương hiệu
        </label>
        <select
          id="filter-brand"
          name="brand"
          defaultValue={filters.brand ?? ''}
          className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
        >
          <option value="">Tất cả</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-min" className="mb-1.5 block text-(length:--text-sm) font-medium">
            Giá từ
          </label>
          <input
            id="filter-min"
            name="minPrice"
            type="number"
            min={0}
            step={100000}
            defaultValue={filters.minPrice ?? ''}
            placeholder="0"
            className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
          />
        </div>
        <div>
          <label htmlFor="filter-max" className="mb-1.5 block text-(length:--text-sm) font-medium">
            Đến
          </label>
          <input
            id="filter-max"
            name="maxPrice"
            type="number"
            min={0}
            step={100000}
            defaultValue={filters.maxPrice ?? ''}
            placeholder="∞"
            className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
          />
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-(length:--text-sm) font-medium">
        <input
          type="checkbox"
          name="inStock"
          value="1"
          defaultChecked={filters.inStock === true}
          className="size-4 rounded border-border"
        />
        Chỉ hiện còn hàng
      </label>

      {filters.sort && filters.sort !== 'relevance' ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}
      {filters.useCase ? <input type="hidden" name="useCase" value={filters.useCase} /> : null}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
        >
          Áp dụng
        </button>
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-border text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          Xóa bộ lọc
        </Link>
      </div>
    </form>
  )
}
