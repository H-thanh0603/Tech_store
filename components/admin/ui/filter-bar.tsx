import type { ReactNode } from 'react'

type FilterBarProps = {
  children: ReactNode
  actions?: ReactNode
}

export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-border bg-surface-raised p-3 shadow-(--shadow-sm) sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

type FilterChipProps = {
  href: string
  active?: boolean
  children: ReactNode
}

/** Server-friendly filter chip (uses <a> for URL state). */
export function FilterChip({ href, active, children }: FilterChipProps) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-3 text-(length:--text-sm) font-medium ${
        active
          ? 'bg-accent text-accent-fg'
          : 'bg-surface-muted text-fg-muted hover:bg-surface-muted hover:text-fg'
      }`}
    >
      {children}
    </a>
  )
}
