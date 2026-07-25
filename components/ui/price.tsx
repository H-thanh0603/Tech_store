import { formatPrice } from '@/lib/format'

type PriceProps = {
  amount: number
  compareAt?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'text-(length:--text-sm)',
  md: 'text-(length:--text-lg)',
  lg: 'text-(length:--text-2xl)',
} as const

export function Price({ amount, compareAt, size = 'md', className }: PriceProps) {
  const showCompare =
    compareAt != null && Number.isFinite(compareAt) && compareAt > amount && amount >= 0

  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className ?? ''}`}>
      <span
        className={`font-semibold tabular-nums tracking-tight text-[var(--color-price)] ${SIZE[size]}`}
      >
        {formatPrice(amount)}
      </span>
      {showCompare ? (
        <span className="text-(length:--text-sm) tabular-nums text-fg-subtle line-through">
          {formatPrice(compareAt)}
        </span>
      ) : null}
    </div>
  )
}
