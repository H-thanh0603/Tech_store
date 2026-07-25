import Link from 'next/link'

export default function ProductNotFound() {
  return (
    <section aria-labelledby="notfound-heading" className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 id="notfound-heading" className="text-(length:--text-2xl) font-semibold text-fg">
        Không tìm thấy sản phẩm
      </h1>
      <p className="max-w-prose text-(length:--text-sm) text-fg-muted">
        Sản phẩm bạn tìm có thể đã ngừng bán hoặc đường dẫn không đúng.
      </p>
      <Link
        href="/products"
        className="inline-flex min-h-(--size-touch) items-center rounded-(--radius-md) bg-accent px-4 text-(length:--text-sm) font-medium text-accent-fg hover:bg-accent-hover"
      >
        Xem tất cả sản phẩm
      </Link>
    </section>
  )
}
