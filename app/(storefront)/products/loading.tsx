export default function ProductsLoading() {
  const placeholders = Array.from({ length: 8 }, (_, index) => index)

  return (
    <section className="container-store flex flex-col gap-6 py-8 sm:py-10" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 skeleton-shimmer rounded" />
        <div className="h-9 w-48 skeleton-shimmer rounded" />
        <div className="h-4 w-64 skeleton-shimmer rounded" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="hidden h-96 skeleton-shimmer rounded-(--radius-lg) lg:block" />
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-hidden="true"
        >
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
      </div>
      <span className="sr-only">Đang tải sản phẩm…</span>
    </section>
  )
}
