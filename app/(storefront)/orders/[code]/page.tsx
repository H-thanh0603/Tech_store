import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { getOrderByAccess } from '@/lib/commerce/queries'

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const order = await getOrderByAccess(code)
  if (!order) notFound()
  return (
    <div className="container-store grid max-w-3xl gap-6 py-8 sm:py-10">
      <h1 className="text-(length:--text-3xl) font-semibold tracking-tight">
        Đơn hàng {order.orderCode}
      </h1>
      <OrderStatus status={order.orderStatus} paymentStatus={order.paymentStatus} />
      <PaymentSummary order={order} />
    </div>
  )
}
