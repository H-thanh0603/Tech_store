import type { ReactNode } from 'react'

import { EmptyState } from '@/components/admin/ui/empty-state'
import { ErrorState } from '@/components/admin/ui/error-state'
import { TableSkeleton } from '@/components/admin/ui/loading-skeleton'
import { AdminPagination } from '@/components/admin/ui/pagination'

export type DataTableColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Hide on small screens when set. */
  hideOnMobile?: boolean
  className?: string
  headerClassName?: string
}

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  /** Optional toolbar above the table (search/filters). */
  toolbar?: ReactNode
  /** Row action menu slot (render inside last column yourself, or use this for bulk bar later). */
  bulkActions?: ReactNode
  selectedCount?: number
  totalCount?: number
  page?: number
  pageCount?: number
  hrefForPage?: (page: number) => string
  /** Accessible name for the table region. */
  caption?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  error = null,
  emptyTitle = 'Không có dữ liệu',
  emptyDescription,
  emptyAction,
  toolbar,
  bulkActions,
  selectedCount = 0,
  totalCount,
  page,
  pageCount,
  hrefForPage,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="space-y-3">
      {toolbar}

      {selectedCount > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-accent/30 bg-accent-subtle px-3 py-2 text-(length:--text-sm)">
          <span className="font-medium text-accent">{selectedCount} đã chọn</span>
          <div className="flex flex-wrap gap-2">{bulkActions}</div>
        </div>
      ) : null}

      {loading ? <TableSkeleton cols={Math.min(columns.length, 5)} /> : null}

      {!loading && error ? <ErrorState message={error} /> : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
          <table className="min-w-full text-left text-(length:--text-sm)">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-surface-muted text-fg-muted">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={`px-4 py-3 font-medium ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.headerClassName ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={getRowId(row)} className="border-t border-border hover:bg-surface-muted/40">
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-4 py-3 align-middle ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading &&
      !error &&
      page != null &&
      pageCount != null &&
      hrefForPage != null &&
      (pageCount > 1 || totalCount != null) ? (
        <AdminPagination
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
          hrefForPage={hrefForPage}
        />
      ) : null}
    </div>
  )
}
