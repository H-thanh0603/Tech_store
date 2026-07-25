import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { OrderStatus } from '@/components/commerce/order-status'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import { ORDER_ACCESS_COOKIE } from '@/lib/commerce/cookies'
import { sha256Hex } from '@/lib/commerce/tokens'
import type { OrderConfirmationData } from '@/lib/commerce/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function OrderConfirmationPage({ params }: { params: Promise<{ code: string }> }) {
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
    <div className="grid gap-6">
      <header><p className="text-sm uppercase tracking-wide text-fg-subtle">Đặt hàng thành công</p><h1 className="text-3xl font-semibold">Đơn hàng {order.orderCode}</h1></header>
      <OrderStatus status={order.orderStatus} paymentStatus={order.paymentStatus} />
      <PaymentSummary order={order} />
    </div>
  )
}
