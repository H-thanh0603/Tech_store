import type { OrderStatus as OrderStatusValue, PaymentStatus } from '@/lib/commerce/types'

const LABELS: Record<OrderStatusValue, string> = {
  pending: 'Đang xử lý', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói', shipping: 'Đang giao hàng', completed: 'Hoàn thành',
  cancelled: 'Đã hủy', expired: 'Đã hết hạn',
}

const STEPS: OrderStatusValue[] = ['pending', 'confirmed', 'packing', 'shipping', 'completed']

type OrderStatusProps = { status: OrderStatusValue; paymentStatus: PaymentStatus }

export function OrderStatus({ status, paymentStatus }: OrderStatusProps) {
  return (
    <section aria-labelledby="order-status-heading" className="rounded-lg border border-border p-5">
      <h2 id="order-status-heading" className="text-xl font-semibold">{LABELS[status]}</h2>
      <p className="mt-1 text-sm text-fg-muted">Thanh toán: {paymentStatus}</p>
      <ol className="mt-4 grid gap-2">
        {STEPS.map((step) => <li key={step} aria-current={step === status ? 'step' : undefined}>{LABELS[step]}</li>)}
      </ol>
    </section>
  )
}
