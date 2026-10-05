'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { requestRestockAlert, type RestockActionState } from '@/lib/customer/restock-actions'

const initial: RestockActionState = { ok: false }

export function RestockAlertForm({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState(requestRestockAlert, initial)

  if (state.ok) {
    return (
      <p className="rounded-(--radius-md) border border-success/40 bg-success/10 px-3 py-2 text-(length:--text-sm) text-success">
        Đã đăng ký — có hàng shop gửi email ngay.
      </p>
    )
  }

  return (
    <form action={action}
      className="space-y-2 rounded-(--radius-lg) border border-border bg-surface-raised p-4"
    >
      <input type="hidden" name="variantId" value={variantId} />
      <p className="text-(length:--text-sm) font-medium text-fg">
        Hết hàng — để lại email, có hàng báo ngay
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="Email của bạn"
          aria-label="Email nhận báo có hàng"
          className="min-h-11 min-w-0 flex-1 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
        />
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? 'Đang gửi…' : 'Báo khi có hàng'}
        </Button>
      </div>
      {state.message ? (
        <p role="status" className={`text-(length:--text-sm) ${state.ok ? 'text-success' : 'text-danger'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
