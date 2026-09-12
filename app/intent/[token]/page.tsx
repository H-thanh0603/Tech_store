import Link from 'next/link'
import { notFound } from 'next/navigation'

import { approveIntent, declineIntent } from './actions'
import { getIntentByToken } from './intent'

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}₫`
}

export default async function IntentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams
  const intent = await getIntentByToken(token)
  if (!intent) notFound()

  const total = intent.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <main className="container-store py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-accent">TechStore · Duyệt gợi ý của AI</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {intent.status === 'pending'
              ? 'AI đã chọn giúp bạn những món này'
              : intent.status === 'converted'
                ? 'Đã chuyển vào giỏ hàng'
                : intent.status === 'declined'
                  ? 'Đã từ chối gợi ý'
                  : 'Liên kết đã hết hạn'}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Gợi ý bởi AI ({intent.agentName}) · {intent.status === 'pending' ? 'chưa phải đơn hàng' : `trạng thái: ${intent.status}`}
          </p>
        </div>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {intent.items.map((item) => (
            <li key={item.sku} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">
                  <Link href={`/products/${item.slug}`} className="hover:text-accent">
                    {item.name}
                  </Link>
                </p>
                <p className="text-sm text-fg-muted">
                  SKU {item.sku} · ×{item.quantity}
                </p>
              </div>
              <p className="font-semibold">{formatVnd(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <p className="text-right text-lg font-semibold">Tạm tính: {formatVnd(total)}</p>

        {intent.status === 'pending' ? (
          <div className="space-y-3">
            {error ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <p className="text-sm text-fg-muted">
              Tồn kho kiểm tra lại lúc duyệt. Bấm duyệt sẽ chuyển các món vào giỏ của bạn và sang trang
              thanh toán — tiền chỉ trừ khi chính bạn hoàn tất đặt hàng.
            </p>
            <form action={approveIntent.bind(null, token)}>
              <button
                type="submit"
                className="w-full rounded-lg bg-brand px-5 py-3 font-semibold text-white"
              >
                Duyệt — chuyển vào giỏ & thanh toán
              </button>
            </form>
            <form action={declineIntent.bind(null, token)}>
              <button
                type="submit"
                className="w-full rounded-lg border border-border px-5 py-3 font-medium"
              >
                Từ chối gợi ý
              </button>
            </form>
          </div>
        ) : intent.status === 'converted' ? (
          <Link
            href="/cart"
            className="block w-full rounded-lg bg-brand px-5 py-3 text-center font-semibold text-white"
          >
            Mở giỏ hàng của bạn
          </Link>
        ) : null}
      </div>
    </main>
  )
}
