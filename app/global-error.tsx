'use client'

import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  Sentry.captureException(error, { tags: { boundary: 'global' } })

  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Lỗi nghiêm trọng</h1>
        <p className="text-sm opacity-70">
          Ứng dụng không tải được. Thử tải lại trang.
          {error.digest ? ` Mã: ${error.digest}.` : ''}
        </p>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border px-4 py-2"
        >
          Tải lại
        </button>
      </body>
    </html>
  )
}
