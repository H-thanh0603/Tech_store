import type { ReactNode } from 'react'

import { EmptyState } from '@/components/admin/ui/empty-state'
import { ErrorState } from '@/components/admin/ui/error-state'

type DashboardBlockProps = {
  title: string
  description?: string
  actions?: ReactNode
  error?: string | null
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  children: ReactNode
}

export function DashboardBlock({
  title,
  description,
  actions,
  error,
  empty,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  children,
}: DashboardBlockProps) {
  return (
    <section className="rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm) sm:p-5">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0">
          <h3 className="text-(length:--text-base) font-semibold text-fg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-(length:--text-sm) text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!error && empty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : null}
      {!error && !empty ? children : null}
    </section>
  )
}
