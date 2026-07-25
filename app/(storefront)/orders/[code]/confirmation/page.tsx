import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { ORDER_ACCESS_COOKIE } from '@/lib/commerce/cookies'
import { sha256Hex } from '@/lib/commerce/tokens'
import type { OrderConfirmationData } from '@/lib/commerce/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const token = (await cookies()).get(ORDER_ACCESS_COOKIE)?.value
  if (!token) notFound()
  const { data, error } = await getSupabaseServerClient().rpc('order_get_by_access', {
    p_order_code: code,
    p_access_token_hash: await sha256Hex(token),
  })
  if (error || !data || data.code !== 'OK') notFound()
  const order = data as OrderConfirmationData

  return (
    <div className="container-store grid max-w-3xl gap-8 py-10 sm:py-14">
      <header className="rounded-(--radius-xl) border border-border bg-brand-soft/40 p-6 sm:p-8">
        <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-brand">
          Đặt hàng thành công
        </p>
        <h1 className="mt-2 text-(length:--text-3xl) font-semibold tracking-tight text-fg">
          Cảm ơn bạn — đơn {order.orderCode}
        </h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Lưu mã đơn và số điện thoại để tra cứu. Không cần tài khoản.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/orders/${order.orderCode}`}
            className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg"
          >
            Xem chi tiết đơn
          </Link>
          <Link
            href="/track-order"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg"
          >
            Tra cứu sau
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) px-4 text-(length:--text-sm) font-semibold text-brand"
          >
            Tiếp tục mua →
          </Link>
        </div>
      </header>

      <section className="rounded-(--radius-lg) border border-border bg-bg-elevated p-5">
        <h2 className="font-semibold text-fg">Bước tiếp theo</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-(length:--text-sm) text-fg-muted">
          <li>Kiểm tra trạng thái đơn bên dưới.</li>
          <li>Nếu chuyển khoản — thanh toán đúng số tiền và nội dung theo hướng dẫn.</li>
          <li>Liên hệ hỗ trợ nếu cần đổi địa chỉ (demo: dùng form tra cứu).</li>
        </ol>
      </section>

      <OrderStatus status={order.orderStatus} paymentStatus={order.paymentStatus} />
      <PaymentSummary order={order} />
    </div>
  )
}
