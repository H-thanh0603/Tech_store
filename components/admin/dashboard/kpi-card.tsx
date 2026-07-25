import Link from 'next/link'

import { percentChange } from '@/lib/admin/dashboard-math'

type KpiCardProps = {
  label: string
  value: string
  definition: string
  href?: string
  previousValue?: number
  currentNumeric?: number
  previousLabel?: string
}

export function KpiCard({
  label,
  value,
  definition,
  href,
  previousValue,
  currentNumeric,
  previousLabel = 'kỳ trước',
}: KpiCardProps) {
  const change =
    currentNumeric != null && previousValue != null
      ? percentChange(currentNumeric, previousValue)
      : null

  const content = (
    <div className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm) transition-shadow hover:shadow-(--shadow-md)">
      <div className="flex items-start justify-between gap-2">
        <p className="text-(length:--text-sm) text-fg-muted">{label}</p>
        <span
          className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full bg-surface-muted text-(length:--text-xs) font-semibold text-fg-subtle"
          title={definition}
          aria-label={definition}
        >
          ?
        </span>
      </div>
      <p className="mt-2 text-(length:--text-2xl) font-semibold tabular-nums tracking-tight text-fg">
        {value}
      </p>
      {change != null ? (
        <p
          className={`mt-2 text-(length:--text-xs) font-medium tabular-nums ${
            change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-fg-muted'
          }`}
        >
          {change > 0 ? '+' : ''}
          {change.toFixed(1)}% so với {previousLabel}
        </p>
      ) : previousValue != null ? (
        <p className="mt-2 text-(length:--text-xs) text-fg-subtle">
          Không đủ dữ liệu để so sánh {previousLabel}
        </p>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-offset-4">
        {content}
      </Link>
    )
  }
  return content
}
