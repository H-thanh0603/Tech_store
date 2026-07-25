import Link from 'next/link'

import type { DashboardChartRange } from '@/lib/admin/types'

const OPTIONS: Array<{ value: DashboardChartRange; label: string }> = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
]

export function RangeTabs({
  range,
  metric,
}: {
  range: DashboardChartRange
  metric?: 'revenue' | 'quantity'
}) {
  const metricQs = metric ? `&metric=${metric}` : ''
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Khoảng thời gian">
      {OPTIONS.map((opt) => {
        const active = range === opt.value
        return (
          <Link
            key={opt.value}
            href={`/admin?range=${opt.value}${metricQs}`}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-3 text-(length:--text-sm) font-medium ${
              active
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-muted text-fg-muted hover:text-fg'
            }`}
          >
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}
