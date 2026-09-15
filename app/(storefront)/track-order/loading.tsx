export default function TrackOrderLoading() {
  return (
    <div className="container-store grid max-w-xl gap-4 py-10" aria-busy="true" aria-label="Đang tải tra cứu">
      <div className="h-7 w-1/2 animate-pulse rounded bg-surface-muted" />
      <div className="h-11 w-full animate-pulse rounded-(--radius-md) bg-surface-muted" />
      <div className="h-11 w-full animate-pulse rounded-(--radius-md) bg-surface-muted" />
      <div className="h-11 w-1/3 animate-pulse rounded-(--radius-md) bg-surface-muted" />
    </div>
  )
}
