export default function ProductLoading() {
  return (
    <div className="container-store grid gap-8 py-10" aria-busy="true" aria-label="Đang tải sản phẩm">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-(--radius-lg) bg-surface-muted" />
        <div className="grid content-start gap-3">
          <div className="h-7 w-3/4 animate-pulse rounded bg-surface-muted" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-surface-muted" />
          <div className="h-10 w-1/2 animate-pulse rounded bg-surface-muted" />
          <div className="h-11 w-full animate-pulse rounded-(--radius-md) bg-surface-muted" />
        </div>
      </div>
    </div>
  )
}
