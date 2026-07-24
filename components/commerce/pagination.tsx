import Link from 'next/link'

import { buildCatalogQuery } from '@/lib/catalog/search-params'
import type { CatalogFilters } from '@/lib/catalog/types'

interface PaginationProps {
  page: number
  pageCount: number
  filters: CatalogFilters
}

// Server-rendered pagination. Each link carries the active filters so paging
// never drops the current query/sort. The current page is a non-link span with
// aria-current; disabled prev/next at the ends render as inert spans.
export function Pagination({ page, pageCount, filters }: PaginationProps) {
  if (pageCount <= 1) {
    return null
  }

  const hrefFor = (target: number): string =>
    `/products${buildCatalogQuery({ ...filters, page: target })}`

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  const hasPrev = page > 1
  const hasNext = page < pageCount

  const edgeClass =
    'inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) border border-border px-3 text-(length:--text-sm)'

  return (
    <nav aria-label="Phân trang" className="flex items-center justify-center gap-1">
      {hasPrev ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={`${edgeClass} text-fg hover:bg-surface-muted`}>
          Trước
        </Link>
      ) : (
        <span className={`${edgeClass} text-fg-subtle`} aria-disabled="true">
          Trước
        </span>
      )}

      <ul className="flex items-center gap-1">
        {pages.map((target) => {
          const isCurrent = target === page
          return (
            <li key={target}>
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) bg-accent px-3 text-(length:--text-sm) font-medium text-accent-fg"
                >
                  {target}
                </span>
              ) : (
                <Link
                  href={hrefFor(target)}
                  className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) border border-border px-3 text-(length:--text-sm) text-fg hover:bg-surface-muted"
                >
                  {target}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {hasNext ? (
        <Link href={hrefFor(page + 1)} rel="next" className={`${edgeClass} text-fg hover:bg-surface-muted`}>
          Sau
        </Link>
      ) : (
        <span className={`${edgeClass} text-fg-subtle`} aria-disabled="true">
          Sau
        </span>
      )}
    </nav>
  )
}
