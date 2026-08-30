'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/ui/status-badge'
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
  return_requested: 'Yêu cầu trả hàng',
  returned: 'Đã trả hàng',
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
  const [pendingTo, setPendingTo] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const next = allowedNextOrderStatuses(orderStatus)

  return (
    <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm)">
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={orderStatus} label={STATUS_LABEL[orderStatus]} />
        <StatusBadge status={paymentStatus} label={`TT: ${paymentStatus}`} />
      </div>

      {next.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {next.map((status) => (
              <Button
                key={status}
                type="button"
                variant={pendingTo === status ? 'primary' : 'secondary'}
                disabled={statusPending}
                onClick={() => setPendingTo(status)}
              >
                → {STATUS_LABEL[status]}
              </Button>
            ))}
          </div>

          {pendingTo ? (
            <form action={statusAction} className="space-y-2 rounded-(--radius-md) border border-border p-3">
              <input type="hidden" name="orderCode" value={orderCode} />
              <input type="hidden" name="orderStatus" value={pendingTo} />
              <p className="text-(length:--text-sm) font-medium">
                Xác nhận chuyển sang <strong>{STATUS_LABEL[pendingTo]}</strong>
              </p>
              {(pendingTo === 'cancelled' || pendingTo === 'expired') && (
                <div>
                  <label htmlFor="cancel-reason" className="mb-1 block text-(length:--text-sm)">
                    Lý do hủy (bắt buộc)
                  </label>
                  <textarea
                    id="cancel-reason"
                    name="reason"
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 py-2 text-(length:--text-sm)"
                  />
                </div>
              )}
              {pendingTo !== 'cancelled' && pendingTo !== 'expired' ? (
                <input type="hidden" name="reason" value="" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={statusPending}>
                  {statusPending ? '…' : 'Xác nhận'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPendingTo(null)}>
                  Hủy
                </Button>
              </div>
            </form>
          ) : null}
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
