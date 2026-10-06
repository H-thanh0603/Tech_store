'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cancelOrder } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

export function CancelOrderForm({
  orderCode,
  customerPhone,
}: {
  orderCode: string
  customerPhone?: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    cancelOrder,
    { ok: true },
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Hủy đơn hàng
      </Button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-(--radius-lg) border border-border bg-surface-raised p-4">
      <input type="hidden" name="orderCode" value={orderCode} />
      {customerPhone ? (
        <input type="hidden" name="phone" value={customerPhone} />
      ) : (
        <div>
          <label
            htmlFor="cancel-phone"
            className="block text-(length:--text-sm) font-medium text-fg"
          >
            Số điện thoại đặt hàng
          </label>
          <input
            id="cancel-phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
          />
        </div>
      )}
      <div>
        <label
          htmlFor="cancel-reason"
          className="block text-(length:--text-sm) font-medium text-fg"
        >
          Lý do hủy (tùy chọn)
        </label>
        <input
          id="cancel-reason"
          name="reason"
          type="text"
          maxLength={500}
          placeholder="Đổi ý, đặt nhầm, tìm được giá tốt hơn…"
          className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
        />
      </div>
      <p className="text-(length:--text-xs) text-fg-muted">
        Chỉ hủy được đơn chưa thanh toán, trước khi shop đóng gói. Mã giảm giá (nếu có) tự hoàn lại.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? 'Đang hủy…' : 'Xác nhận hủy đơn'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Giữ đơn
        </Button>
      </div>
      {state.ok === false ? (
        <p className="text-(length:--text-sm) text-danger">{state.message}</p>
      ) : null}
      {state.ok === true && state.message ? (
        <p className="text-(length:--text-sm) text-success">{state.message}</p>
      ) : null}
    </form>
  )
}
