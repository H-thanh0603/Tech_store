'use client'

import Link from 'next/link'

export default function StorefrontError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  return (
    <main className="container-store py-16">
      <div className="mx-auto max-w-lg rounded-(--radius-lg) border border-border bg-bg-elevated p-8 text-center shadow-(--shadow-sm)">
        <h1 className="text-(length:--text-xl) font-semibold text-fg">Có lỗi xảy ra</h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Không tải được trang này. Thử lại hoặc quay về trang chủ.
        </p>
        {error.digest ? (
          <p className="mt-2 text-(length:--text-xs) text-fg-subtle">Mã lỗi: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg"
          >
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold text-fg"
          >
            Trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
