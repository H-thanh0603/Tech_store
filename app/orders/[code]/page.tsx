import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { getOrderByAccess } from '@/lib/commerce/queries'

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const order = await getOrderByAccess(code)
  if (!order) notFound()
  return <div className="grid gap-6"><h1 className="text-3xl font-semibold">Đơn hàng {order.orderCode}</h1><OrderStatus status={order.orderStatus} paymentStatus={order.paymentStatus} /><PaymentSummary order={order} /></div>
}
