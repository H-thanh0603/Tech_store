'use client'

import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-(--radius-lg) border border-border bg-bg-elevated p-8 text-center shadow-(--shadow-sm)">
        <h1 className="text-(length:--text-lg) font-semibold text-fg">Lỗi admin</h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Không tải được trang quản trị. Thử lại hoặc quay về dashboard.
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
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold text-fg"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
