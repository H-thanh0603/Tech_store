'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useId } from 'react'

import { CATALOG_SORTS, type CatalogSort } from '@/lib/catalog/types'

const SORT_LABELS: Record<CatalogSort, string> = {
  relevance: 'Liên quan',
  'price-asc': 'Giá tăng dần',
  'price-desc': 'Giá giảm dần',
  newest: 'Mới nhất',
}

interface CatalogSortProps {
  value: CatalogSort
}

// Client sort control: writes the chosen sort onto the current URL and resets
// to page 1 so the result set starts from the top. Reads live searchParams so
// it preserves query/category/brand/price filters already in the URL.
export function CatalogSort({ value }: CatalogSortProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectId = useId()

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(searchParams.toString())
    const sort = event.target.value

    if (sort === 'relevance') {
      next.delete('sort')
    } else {
      next.set('sort', sort)
    }
    next.delete('page')

    const query = next.toString()
    router.push(query ? `/products?${query}` : '/products')
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-(length:--text-sm) text-fg-muted">
        Sắp xếp
      </label>
      <select
        id={selectId}
        value={value}
        onChange={handleChange}
        className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface px-3 text-(length:--text-sm) text-fg focus-visible:border-accent"
      >
        {CATALOG_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>
    </div>
  )
}
