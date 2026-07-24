'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { checkoutAction } from '@/lib/commerce/actions'
import type { ActionState, CartData } from '@/lib/commerce/types'
import { formatPrice } from '@/lib/format'

type CheckoutFormProps = {
  cart: CartData
  initialState: ActionState
}

export function CheckoutForm({ cart, initialState }: CheckoutFormProps) {
  const [state, formAction, isPending] = useActionState(checkoutAction, initialState)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const fieldError = (name: string) => (!state.ok ? state.fieldErrors?.[name]?.[0] : undefined)

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <section aria-labelledby="customer-heading" className="grid gap-4 rounded-lg border border-border bg-surface-raised p-5">
        <h2 id="customer-heading" className="text-xl font-semibold">Thông tin nhận hàng</h2>
        {[
          ['customerName', 'Họ và tên'], ['customerPhone', 'Số điện thoại'],
          ['customerEmail', 'Email (không bắt buộc)'], ['province', 'Tỉnh/thành phố'],
          ['district', 'Quận/huyện'], ['ward', 'Phường/xã'],
          ['streetAddress', 'Địa chỉ cụ thể'], ['note', 'Ghi chú'],
        ].map(([name, label]) => {
          const error = fieldError(name)
          return (
            <label key={name} className="grid gap-1 text-sm font-medium">
              {label}
              <input name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} className="min-h-11 rounded-md border border-border bg-surface px-3" />
              {error ? <span id={`${name}-error`} className="text-danger">{error}</span> : null}
            </label>
          )
        })}
        <fieldset className="grid gap-2">
          <legend className="font-medium">Phương thức thanh toán</legend>
          <label><input type="radio" name="paymentMethod" value="cod" defaultChecked /> COD - thanh toán khi nhận hàng</label>
          <label><input type="radio" name="paymentMethod" value="bank_transfer" /> Chuyển khoản ngân hàng</label>
        </fieldset>
      </section>
      <aside className="rounded-lg border border-border bg-surface-raised p-5">
        <h2 className="text-xl font-semibold">Tóm tắt</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Giảm giá</dt><dd>-{formatPrice(cart.discountTotal)}</dd></div>
          <div className="flex justify-between"><dt>Vận chuyển</dt><dd>Miễn phí</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Tổng cộng</dt><dd>{formatPrice(cart.total)}</dd></div>
        </dl>
        {!state.ok ? <p role="alert" className="mt-3 text-sm text-danger">{state.message}</p> : null}
        <Button type="submit" className="mt-5 w-full" disabled={isPending || !cart.canCheckout}>
          {isPending ? 'Đang đặt hàng...' : 'Đặt hàng'}
        </Button>
      </aside>
    </form>
  )
}
