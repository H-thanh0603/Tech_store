'use client'

import { useEffect } from 'react'

import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: 'storefront' } })
  }, [error])

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Có lỗi xảy ra</h1>
      <p className="text-sm text-muted-foreground">
        Trang này gặp sự cố ngoài ý muốn. Bạn có thể thử lại, về trang chủ hoặc tra cứu đơn hàng.
        {error.digest ? ` Mã lỗi: ${error.digest}.` : ''}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded bg-primary px-4 text-primary-foreground">
          Thử lại
        </button>
        <Link href="/" className="min-h-11 rounded border px-4 py-2">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
