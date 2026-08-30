'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { requestReturn } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

const REASONS = [
  { value: 'defective', label: 'Sản phẩm lỗi / hỏng' },
  { value: 'wrong_item', label: 'Nhận sai sản phẩm' },
  { value: 'not_as_described', label: 'Không đúng mô tả' },
  { value: 'changed_mind', label: 'Đổi ý (phí có thể áp dụng)' },
  { value: 'other', label: 'Lý do khác' },
] as const

export function ReturnRequestForm({
  orderCode,
  customerPhone,
}: {
  orderCode: string
  customerPhone?: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestReturn,
    { ok: true },
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Yêu cầu trả hàng / đổi trả
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
            htmlFor="phone"
            className="block text-(length:--text-sm) font-medium text-fg"
          >
            Số điện thoại đặt hàng
          </label>
          <input
            id="phone"
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
          htmlFor="reasonCode"
          className="block text-(length:--text-sm) font-medium text-fg"
        >
          Lý do trả hàng
        </label>
        <select
          id="reasonCode"
          name="reasonCode"
          required
          defaultValue="defective"
          className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="customerNote"
          className="block text-(length:--text-sm) font-medium text-fg"
        >
          Ghi chú thêm (tùy chọn)
        </label>
        <textarea
          id="customerNote"
          name="customerNote"
          rows={3}
          maxLength={1000}
          placeholder="Mô tả tình trạng sản phẩm, kèm ảnh nếu có..."
          className="mt-1 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 py-2 text-(length:--text-sm) text-fg"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Đóng
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
