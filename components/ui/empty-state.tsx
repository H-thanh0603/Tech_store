import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-(--radius-lg) border border-dashed border-border bg-surface-muted/40 px-6 py-12 text-center"
    >
      <p className="text-(length:--text-base) font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-(length:--text-sm) text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
