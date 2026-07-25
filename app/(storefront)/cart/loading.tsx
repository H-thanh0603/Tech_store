export default function CartLoading() {
  return (
    <section aria-label="Đang tải giỏ hàng" className="flex flex-col gap-4">
      <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
      <div className="h-10 w-64 animate-pulse rounded bg-surface-muted" />
      <div className="h-40 animate-pulse rounded-(--radius-lg) bg-surface-muted" />
    </section>
  )
}
