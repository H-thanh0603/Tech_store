import Image from 'next/image'

import type { OrderConfirmationData } from '@/lib/commerce/types'
import { buildVietQrUrl, getVietQrConfig, getVietQrText } from '@/lib/commerce/vietqr'
import { formatPrice } from '@/lib/format'

type PaymentSummaryProps = { order: OrderConfirmationData }

export function PaymentSummary({ order }: PaymentSummaryProps) {
  const fulfillment = order.fulfillmentMethod === 'pickup' && order.pickupStore ? (
    <section className="rounded-lg border border-brand p-5">
      <h2 className="font-semibold">Nhận tại {order.pickupStore.name}</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {order.pickupStore.address}, {order.pickupStore.district}, {order.pickupStore.province}
      </p>
      <p className="mt-1 text-sm text-fg-muted">Mở cửa {order.pickupStore.openingHours}{order.pickupStore.phone ? ` · ${order.pickupStore.phone}` : ''}</p>
    </section>
  ) : null

  let payment
  if (order.paymentMethod === 'cod') {
    payment = <p className="rounded-lg border border-border p-5">Thanh toán khi nhận hàng (COD).</p>
  } else if (order.paymentStatus === 'expired' || order.orderStatus === 'expired') {
    payment = <p className="rounded-lg border border-danger p-5 text-danger">Phiên chuyển khoản đã hết hạn.</p>
  } else {
    const input = { ...getVietQrConfig(), amount: order.total, description: order.orderCode }
    const details = getVietQrText(input)
    payment = (
      <section aria-labelledby="transfer-heading" className="grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-[12rem_1fr]">
        <Image unoptimized src={buildVietQrUrl(input)} width={192} height={192} alt={`Mã QR chuyển khoản cho đơn ${order.orderCode}`} />
        <div><h2 id="transfer-heading" className="text-xl font-semibold">Chuyển khoản ngân hàng</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div><dt>Ngân hàng</dt><dd>{details.bankId}</dd></div>
            <div><dt>Số tài khoản</dt><dd>{details.accountNo}</dd></div>
            <div><dt>Chủ tài khoản</dt><dd>{details.accountName}</dd></div>
            <div><dt>Số tiền</dt><dd>{formatPrice(details.amount)}</dd></div>
            <div><dt>Nội dung</dt><dd>{details.description}</dd></div>
          </dl>
        </div>
      </section>
    )
  }
  return (
    <div className="grid gap-4">
      {fulfillment}
      {payment}
    </div>
  )
}
