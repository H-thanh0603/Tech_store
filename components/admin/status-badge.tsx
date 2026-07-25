const STYLES: Record<string, string> = {
  pending: 'bg-warm-subtle text-fg',
  awaiting_payment: 'bg-warm-subtle text-fg',
  confirmed: 'bg-accent-subtle text-accent',
  packing: 'bg-accent-subtle text-accent',
  shipping: 'bg-accent-subtle text-accent',
  completed: 'bg-success-subtle text-success',
  cancelled: 'bg-danger-subtle text-danger',
  expired: 'bg-danger-subtle text-danger',
  paid: 'bg-success-subtle text-success',
  failed: 'bg-danger-subtle text-danger',
  published: 'bg-success-subtle text-success',
  draft: 'bg-surface-muted text-fg-muted',
  archived: 'bg-danger-subtle text-danger',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const classes = STYLES[status] ?? 'bg-surface-muted text-fg-muted'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-(length:--text-xs) font-semibold ${classes}`}
    >
      {label ?? status}
    </span>
  )
}
