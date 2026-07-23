'use client'

export default function ErrorPage({
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  return (
    <main>
      <h1>Có lỗi rồi</h1>
      <p>Thử lại sau.</p>
      <button type="button" onClick={reset}>
        Thử lại
      </button>
    </main>
  )
}
