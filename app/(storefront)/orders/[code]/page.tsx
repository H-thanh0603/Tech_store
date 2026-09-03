import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { ReturnRequestForm } from '@/components/commerce/return-request-form'
import { CopyButton } from '@/components/ui/copy-button'
import { getOrderByAccess } from '@/lib/commerce/queries'

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const order = await getOrderByAccess(code)
  if (!order) notFound()
  const canRequestReturn = order.orderStatus === 'shipping' || order.orderStatus === 'completed'
  return (
    <div className="container-store grid max-w-3xl gap-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Theo dõi</p>
          <h1 className="mt-1 flex items-center gap-2 text-(length:--text-3xl) font-semibold tracking-tight">
            Đơn hàng {order.orderCode}
            <CopyButton text={order.orderCode} label="Sao chép mã" />
          </h1>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">Lưu mã + SĐT để tra cứu lại bất kỳ lúc nào.</p>
        </div>
        <div className="rounded-full border border-border bg-brand-soft px-3 py-1 text-(length:--text-xs) font-medium text-brand">
          {order.paymentStatus === 'paid' ? 'Đã thanh toán' : order.paymentStatus === 'pending' ? 'Chờ thanh toán' : order.paymentStatus}
        </div>
      </div>
      <OrderStatus status={order.orderStatus} paymentStatus={order.paymentStatus} />
      {canRequestReturn ? (
        <section aria-label="Yêu cầu trả hàng">
          <h2 className="sr-only">Yêu cầu trả hàng</h2>
          <ReturnRequestForm orderCode={order.orderCode} customerPhone={order.customerPhone} />
        </section>
      ) : null}
      <PaymentSummary order={order} />
    </div>
  )
}
