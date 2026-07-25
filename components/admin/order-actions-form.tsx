'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/status-badge'
import { markOrderPaid, updateOrderStatus } from '@/lib/admin/order-actions'
import { allowedNextOrderStatuses, canMarkPaymentPaid } from '@/lib/admin/status-rules'
import type { AdminActionState } from '@/lib/admin/types'
import type { OrderStatus, PaymentStatus } from '@/lib/commerce/types'

const initial: AdminActionState = { ok: true }

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xử lý',
  awaiting_payment: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
}

export function OrderActionsForm({
  orderCode,
  orderStatus,
  paymentStatus,
}: {
  orderCode: string
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
}) {
  const [statusState, statusAction, statusPending] = useActionState(updateOrderStatus, initial)
  const [payState, payAction, payPending] = useActionState(markOrderPaid, initial)
  const next = allowedNextOrderStatuses(orderStatus)

  return (
    <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-border p-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={orderStatus} label={STATUS_LABEL[orderStatus]} />
        <StatusBadge status={paymentStatus} label={`TT: ${paymentStatus}`} />
      </div>

      {next.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {next.map((status) => (
            <form key={status} action={statusAction}>
              <input type="hidden" name="orderCode" value={orderCode} />
              <input type="hidden" name="orderStatus" value={status} />
              <Button type="submit" variant="secondary" disabled={statusPending}>
                → {STATUS_LABEL[status]}
              </Button>
            </form>
          ))}
        </div>
      ) : (
        <p className="text-(length:--text-sm) text-fg-muted">Trạng thái đơn đã khóa (terminal).</p>
      )}

      {!statusState.ok ? (
        <p className="text-(length:--text-sm) text-danger" role="alert">
          {statusState.message}
        </p>
      ) : statusState.message ? (
        <p className="text-(length:--text-sm) text-success">{statusState.message}</p>
      ) : null}

      {canMarkPaymentPaid(paymentStatus) ? (
        <form action={payAction} className="flex flex-col gap-2 border-t border-border pt-4">
          <input type="hidden" name="orderCode" value={orderCode} />
          <label className="inline-flex items-center gap-2 text-(length:--text-sm)">
            <input type="checkbox" name="alsoConfirmOrder" value="true" defaultChecked />
            Đồng thời xác nhận đơn (nếu đang chờ)
          </label>
          <Button type="submit" disabled={payPending}>
            {payPending ? '…' : 'Xác nhận đã thanh toán'}
          </Button>
          {!payState.ok ? (
            <p className="text-(length:--text-sm) text-danger">{payState.message}</p>
          ) : payState.message ? (
            <p className="text-(length:--text-sm) text-success">{payState.message}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
