// Skeleton for the products list while the server fetch resolves. Mirrors the
// grid layout so there is no layout shift when real cards replace it.
export default function ProductsLoading() {
  const placeholders = Array.from({ length: 8 }, (_, index) => index)

  return (
    <section aria-labelledby="products-loading-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1
          id="products-loading-heading"
          className="text-(length:--text-3xl) font-semibold tracking-tight"
        >
          Sản phẩm
        </h1>
        <p className="text-(length:--text-sm) text-fg-muted">Đang tải sản phẩm…</p>
      </div>

      <ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-hidden="true"
      >
        {placeholders.map((index) => (
          <li key={index} className="flex">
            <div className="flex w-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised">
              <div className="aspect-square animate-pulse bg-surface-muted" />
              <div className="flex flex-col gap-2 p-4">
                <div className="h-3 w-16 animate-pulse rounded-(--radius-sm) bg-surface-muted" />
                <div className="h-4 w-full animate-pulse rounded-(--radius-sm) bg-surface-muted" />
                <div className="h-5 w-24 animate-pulse rounded-(--radius-sm) bg-surface-muted" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
