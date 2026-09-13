import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy trang (404)</h1>
      <p className="text-sm text-muted-foreground">
        Liên kết có thể đã cũ hoặc sản phẩm đã ngừng kinh doanh. Thử tìm kiếm hoặc xem danh mục.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="min-h-11 rounded bg-primary px-4 py-2 text-primary-foreground">
          Về trang chủ
        </Link>
        <Link href="/products" className="min-h-11 rounded border px-4 py-2">
          Xem sản phẩm
        </Link>
      </div>
    </main>
  )
}
