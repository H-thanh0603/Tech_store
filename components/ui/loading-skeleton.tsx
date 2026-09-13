type LoadingSkeletonProps = {
  rows?: number
  className?: string
}

export function LoadingSkeleton({ rows = 4, className }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse space-y-3 ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-label="Đang tải"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-11 rounded-(--radius-md) bg-surface-muted"
          style={{ width: `${88 - (index % 3) * 8}%` }}
        />
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  )
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
      role="status"
      aria-live="polite"
      aria-label="Đang tải sản phẩm"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-(--radius-lg) border border-border p-3">
          <div className="aspect-square rounded bg-surface-muted" />
          <div className="mt-3 h-4 w-3/4 rounded bg-surface-muted" />
          <div className="mt-2 h-4 w-1/2 rounded bg-surface-muted" />
        </div>
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  )
}
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="overflow-hidden rounded-(--radius-lg) border border-border"
      role="status"
      aria-label="Đang tải bảng"
    >
      <div className="grid gap-0 bg-surface-muted px-4 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="h-4 w-20 animate-pulse rounded bg-border" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-4 border-t border-border px-4 py-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, col) => (
            <div key={col} className="h-4 animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  )
}
