'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { trackOrder } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

const INITIAL_STATE: ActionState = { ok: true }

export function TrackOrderForm() {
  const [state, action, isPending] = useActionState(trackOrder, INITIAL_STATE)
  return (
    <form
      action={action}
      className="mx-auto grid max-w-lg gap-4 rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)"
    >
      <div className="grid gap-1.5">
        <label htmlFor="track-orderCode" className="text-(length:--text-sm) font-medium text-fg">
          Mã đơn hàng
        </label>
        <input
          id="track-orderCode"
          name="orderCode"
          placeholder="VD: TS-20250101-000001"
          autoComplete="off"
          spellCheck={false}
          required
          className="min-h-11 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) placeholder:text-fg-subtle focus-visible:border-brand"
        />
        <p className="text-(length:--text-xs) text-fg-muted">In trên email xác nhận và trang hoàn tất.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="track-phone" className="text-(length:--text-sm) font-medium text-fg">
          Số điện thoại
        </label>
        <input
          id="track-phone"
          name="phone"
          inputMode="tel"
          placeholder="0901234567"
          required
          className="min-h-11 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) placeholder:text-fg-subtle focus-visible:border-brand"
        />
        <p className="text-(length:--text-xs) text-fg-muted">Số đã dùng khi đặt hàng — dùng để xác thực.</p>
      </div>
      {!state.ok ? (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-danger-subtle px-3 py-2 text-(length:--text-sm) text-danger"
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Đang tra cứu…' : 'Tra cứu đơn hàng'}
      </Button>
      <p className="text-center text-(length:--text-xs) text-fg-subtle">
        Demo local: dùng mã từ seed hoặc đặt thử 1 đơn COD để lấy mã.
      </p>
    </form>
  )
}
