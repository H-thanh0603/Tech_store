import type { OrderStatus as OrderStatusValue, PaymentStatus } from '@/lib/commerce/types'

const LABELS: Record<OrderStatusValue, string> = {
  pending: 'Đang xử lý', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói', shipping: 'Đang giao hàng', completed: 'Hoàn thành',
  cancelled: 'Đã hủy', expired: 'Đã hết hạn',
  return_requested: 'Yêu cầu trả hàng', returned: 'Đã trả hàng',
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại', expired: 'Hết hạn',
}

const STEPS: OrderStatusValue[] = ['pending', 'confirmed', 'packing', 'shipping', 'completed']

// awaiting_payment sits at the pending step; cancelled/expired stop the flow.
function stepIndex(status: OrderStatusValue): number {
  if (status === 'awaiting_payment') return 0
  return STEPS.indexOf(status)
}

type OrderStatusProps = { status: OrderStatusValue; paymentStatus: PaymentStatus }

export function OrderStatus({ status, paymentStatus }: OrderStatusProps) {
  const current = stepIndex(status)
  const stopped = status === 'cancelled' || status === 'expired'

  return (
    <section aria-labelledby="order-status-heading" className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="order-status-heading" className="text-xl font-semibold tracking-tight">
          {LABELS[status]}
        </h2>
        <p className="text-sm text-fg-muted">Thanh toán: {PAYMENT_LABELS[paymentStatus]}</p>
      </div>

      <ol className="mt-6 flex items-start" aria-label="Tiến trình đơn hàng">
        {STEPS.map((step, index) => {
          const done = !stopped && current > index
          const active = !stopped && current === index
          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className="relative flex flex-1 flex-col items-center gap-2 text-center"
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={`absolute left-[-50%] top-3.5 h-0.5 w-full ${done || active ? 'bg-brand' : 'bg-border'}`}
                />
              ) : null}
              <span
                className={`relative z-10 grid size-7 place-items-center rounded-full border-2 text-(length:--text-xs) font-bold ${
                  done
                    ? 'border-brand bg-brand text-white'
                    : active
                      ? 'border-brand bg-bg-elevated text-brand'
                      : 'border-border bg-bg-elevated text-fg-subtle'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={`text-(length:--text-xs) font-medium ${
                  active ? 'text-brand' : done ? 'text-fg' : 'text-fg-subtle'
                }`}
              >
                {LABELS[step]}
              </span>
            </li>
          )
        })}
      </ol>

      {stopped ? (
        <p role="status" className="mt-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          {status === 'cancelled'
            ? 'Đơn đã hủy — các bước tiếp theo không thực hiện.'
            : 'Đơn đã hết hạn thanh toán — đặt lại nếu vẫn muốn mua.'}
        </p>
      ) : null}
    </section>
  )
}
