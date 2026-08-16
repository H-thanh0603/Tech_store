export default function LoadingPage() {
  const placeholders = Array.from({ length: 4 }, (_, index) => index)
  return (
    <div className="container-store flex flex-col gap-8 py-10" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-20 skeleton-shimmer rounded" />
        <div className="h-9 w-64 skeleton-shimmer rounded" />
        <div className="h-4 w-80 max-w-full skeleton-shimmer rounded" />
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {placeholders.map((index) => (
          <li key={index} className="overflow-hidden rounded-(--radius-lg) border border-border">
            <div className="aspect-[4/3] skeleton-shimmer" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 skeleton-shimmer rounded" />
              <div className="h-4 w-full skeleton-shimmer rounded" />
              <div className="h-5 w-24 skeleton-shimmer rounded" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Đang tải…</span>
    </div>
  )
}
