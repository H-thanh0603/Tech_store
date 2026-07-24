'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { applyCoupon } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

type CouponFormProps = {
  appliedCode?: string
  state?: ActionState
}

const INITIAL_STATE: ActionState = { ok: true }

export function CouponForm({ appliedCode, state: initialState }: CouponFormProps) {
  const [state, formAction, isPending] = useActionState(applyCoupon, initialState ?? INITIAL_STATE)
  const error = !state.ok ? state.message : undefined

  return (
    <form action={formAction} className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-sm">
      <label htmlFor="coupon-code" className="text-(length:--text-sm) font-medium text-fg">
        Mã giảm giá
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="coupon-code"
          name="code"
          type="text"
          defaultValue={appliedCode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-(--radius-md) border border-border bg-surface px-3 text-fg placeholder:text-fg-subtle"
          placeholder="Nhập mã giảm giá"
        />
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? 'Đang áp dụng...' : 'Áp dụng'}
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" className="mt-2 text-(length:--text-sm) text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="mt-2 text-(length:--text-sm) text-success" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
