import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { ReturnRequestForm } from '@/components/commerce/return-request-form'
import { getOrderByAccess } from '@/lib/commerce/queries'

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const order = await getOrderByAccess(code)
  if (!order) notFound()
  const canRequestReturn = order.orderStatus === 'shipping' || order.orderStatus === 'completed'
  return (
    <div className="container-store grid max-w-3xl gap-6 py-8 sm:py-10">
      <h1 className="text-(length:--text-3xl) font-semibold tracking-tight">
        Đơn hàng {order.orderCode}
      </h1>
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
