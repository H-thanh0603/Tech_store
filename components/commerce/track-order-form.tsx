'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { trackOrder } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

const INITIAL_STATE: ActionState = { ok: true }

export function TrackOrderForm() {
  const [state, action, isPending] = useActionState(trackOrder, INITIAL_STATE)
  return (
    <form action={action} className="mx-auto grid max-w-lg gap-4 rounded-lg border border-border bg-surface-raised p-5">
      <label className="grid gap-1 font-medium">Mã đơn hàng<input name="orderCode" className="min-h-11 rounded-md border border-border px-3" /></label>
      <label className="grid gap-1 font-medium">Số điện thoại<input name="phone" inputMode="tel" className="min-h-11 rounded-md border border-border px-3" /></label>
      {!state.ok ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? 'Đang tra cứu...' : 'Tra cứu đơn hàng'}</Button>
    </form>
  )
}
