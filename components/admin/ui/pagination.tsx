import Link from 'next/link'

export type AdminPaginationProps = {
  page: number
  pageCount: number
  totalCount?: number
  /** Build href for a given page number (include current filters). */
  hrefForPage: (page: number) => string
}

export function AdminPagination({
  page,
  pageCount,
  totalCount,
  hrefForPage,
}: AdminPaginationProps) {
  if (pageCount <= 1) {
    return totalCount != null ? (
      <p className="text-(length:--text-sm) text-fg-muted">{totalCount} kết quả</p>
    ) : null
  }

  const hasPrev = page > 1
  const hasNext = page < pageCount
  const edgeClass =
    'inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) border border-border px-3 text-(length:--text-sm)'

  const pages = visiblePages(page, pageCount)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      {totalCount != null ? (
        <p className="text-(length:--text-sm) text-fg-muted">
          {totalCount} kết quả · Trang {page}/{pageCount}
        </p>
      ) : (
        <p className="text-(length:--text-sm) text-fg-muted">
          Trang {page}/{pageCount}
        </p>
      )}

      <nav aria-label="Phân trang admin" className="flex items-center gap-1">
        {hasPrev ? (
          <Link href={hrefForPage(page - 1)} rel="prev" className={`${edgeClass} text-fg hover:bg-surface-muted`}>
            Trước
          </Link>
        ) : (
          <span className={`${edgeClass} text-fg-subtle`} aria-disabled="true">
            Trước
          </span>
        )}

        <ul className="flex items-center gap-1">
          {pages.map((target, index) =>
            target === 'ellipsis' ? (
              <li key={`e-${index}`}>
                <span className="px-2 text-fg-subtle" aria-hidden="true">
                  …
                </span>
              </li>
            ) : (
              <li key={target}>
                {target === page ? (
                  <span
                    aria-current="page"
                    className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) bg-accent px-3 text-(length:--text-sm) font-medium text-accent-fg"
                  >
                    {target}
                  </span>
                ) : (
                  <Link
                    href={hrefForPage(target)}
                    className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-(--radius-md) border border-border px-3 text-(length:--text-sm) text-fg hover:bg-surface-muted"
                  >
                    {target}
                  </Link>
                )}
              </li>
            ),
          )}
        </ul>

        {hasNext ? (
          <Link href={hrefForPage(page + 1)} rel="next" className={`${edgeClass} text-fg hover:bg-surface-muted`}>
            Sau
          </Link>
        ) : (
          <span className={`${edgeClass} text-fg-subtle`} aria-disabled="true">
            Sau
          </span>
        )}
      </nav>
    </div>
  )
}

function visiblePages(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const result: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) result.push('ellipsis')
  for (let i = start; i <= end; i += 1) result.push(i)
  if (end < pageCount - 1) result.push('ellipsis')
  result.push(pageCount)
  return result
}
