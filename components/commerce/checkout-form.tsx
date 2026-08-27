'use client'

import { useActionState, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useOptionalToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import { checkoutAction } from '@/lib/commerce/actions'
import type { ActionState, CartData, FulfillmentMethod, PickupStore } from '@/lib/commerce/types'
import { getProfile } from '@/lib/customer/profile'
import { formatPrice } from '@/lib/format'

function readCheckoutDefaults(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const p = getProfile()
  return {
    customerName: p.fullName,
    customerPhone: p.phone,
    customerEmail: p.email,
    province: p.city,
    district: p.district,
    streetAddress: p.addressLine,
  }
}

type CheckoutFormProps = {
  cart: CartData
  initialState: ActionState
  pickupStores?: PickupStore[]
  vnpayEnabled?: boolean
}

const FIELDS: Array<{ name: string; label: string; type?: string; required?: boolean; deliveryOnly?: boolean }> = [
  { name: 'customerName', label: 'Họ và tên', required: true },
  { name: 'customerPhone', label: 'Số điện thoại', required: true },
  { name: 'customerEmail', label: 'Email (không bắt buộc)', type: 'email' },
  { name: 'province', label: 'Tỉnh/thành phố', required: true, deliveryOnly: true },
  { name: 'district', label: 'Quận/huyện', required: true, deliveryOnly: true },
  { name: 'ward', label: 'Phường/xã', required: true, deliveryOnly: true },
  { name: 'streetAddress', label: 'Địa chỉ cụ thể', required: true, deliveryOnly: true },
  { name: 'note', label: 'Ghi chú giao hàng' },
]

export function CheckoutForm({ cart, initialState, pickupStores = [], vnpayEnabled = false }: CheckoutFormProps) {
  const { toast } = useOptionalToast()
  const [state, formAction, isPending] = useActionState(checkoutAction, initialState)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('delivery')
  const [defaults] = useState(readCheckoutDefaults)
  const fieldError = (name: string) => (!state.ok ? state.fieldErrors?.[name]?.[0] : undefined)

  useEffect(() => {
    if (!state.ok && state.message) {
      track('checkout_error', { code: state.code })
      toast({ title: 'Không đặt được hàng', description: state.message, tone: 'error' })
    }
  }, [state, toast])

  useEffect(() => {
    track('begin_checkout', { itemCount: cart.itemCount, total: cart.total })
  }, [cart.itemCount, cart.total])

  const summary = (
    <aside
      aria-labelledby="checkout-summary-heading"
      className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-md)"
    >
      <h2 id="checkout-summary-heading" className="text-(length:--text-xl) font-semibold tracking-tight">
        Tóm tắt đơn
      </h2>
      <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-(length:--text-sm)">
        {cart.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-fg-muted">
              {item.productName} × {item.quantity}
            </span>
            <span className="shrink-0 tabular-nums font-medium">
              {formatPrice(item.currentPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-(length:--text-sm)">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Tạm tính</dt>
          <dd className="tabular-nums">{formatPrice(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">Giảm giá</dt>
          <dd className="tabular-nums text-success">-{formatPrice(cart.discountTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">Vận chuyển</dt>
          <dd className={cart.shippingInfo?.isFree ? 'text-success' : 'tabular-nums'}>
            {cart.shippingInfo?.isFree ? 'Miễn phí' : formatPrice(cart.shippingTotal)}
          </dd>
        </div>
        {!cart.shippingInfo?.isFree && (cart.shippingInfo?.freeThreshold ?? 0) > 0 && (
          <p className="text-(length:--text-xs) text-accent">
            Mua thêm {formatPrice(Math.max(0, (cart.shippingInfo?.freeThreshold ?? 0) - cart.subtotal))} để miễn phí vận chuyển
          </p>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-(length:--text-base) font-semibold">
          <dt>Tổng cộng</dt>
          <dd className="tabular-nums">{formatPrice(cart.total)}</dd>
        </div>
      </dl>
      {!state.ok ? (
        <p role="alert" className="mt-3 rounded-(--radius-md) bg-danger-subtle px-3 py-2 text-(length:--text-sm) text-danger">
          {state.message}
        </p>
      ) : null}
    </aside>
  )

  const submitBlock = (
    <>
      <Button
        type="submit"
        className="mt-5 w-full"
        disabled={isPending || !cart.canCheckout}
      >
        {isPending ? 'Đang đặt hàng…' : 'Đặt hàng'}
      </Button>
      <p className="mt-3 text-center text-(length:--text-xs) text-fg-subtle">
        Guest checkout · Không ép đăng ký · Dữ liệu giữ khi lỗi validation
      </p>
    </>
  )

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="space-y-6">
        <header>
          <p className="eyebrow">Checkout</p>
          <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">
            Thông tin nhận hàng
          </h1>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">
            Một bước — điền form và chọn thanh toán. Không cần tài khoản.
          </p>
        </header>

        <fieldset className="grid gap-3 rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)">
          <legend className="px-1 text-(length:--text-lg) font-semibold">Cách nhận hàng</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-md) border border-border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input
              type="radio"
              name="fulfillmentMethod"
              value="delivery"
              checked={fulfillment === 'delivery'}
              onChange={() => setFulfillment('delivery')}
              className="size-4"
            />
            <span className="text-(length:--text-sm)"><strong>Giao hàng</strong> — phí vận chuyển sẽ được tính</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-md) border border-border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="radio"
              name="fulfillmentMethod"
              value="pickup"
              checked={fulfillment === 'pickup'}
              disabled={pickupStores.length === 0}
              onChange={() => setFulfillment('pickup')}
              className="size-4"
            />
            <span className="text-(length:--text-sm)"><strong>Nhận tại cửa hàng</strong> — giữ hàng tại chi nhánh</span>
          </label>
          {fulfillment === 'pickup' ? (
            <div className="grid gap-1.5">
              <label htmlFor="pickupStoreId" className="text-(length:--text-sm) font-medium">Cửa hàng nhận *</label>
              <select
                id="pickupStoreId"
                name="pickupStoreId"
                required
                defaultValue=""
                className="min-h-11 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
              >
                <option value="" disabled>Chọn cửa hàng còn đủ sản phẩm</option>
                {pickupStores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name} — {store.address}</option>
                ))}
              </select>
              {fieldError('pickupStoreId') ? <span className="text-(length:--text-xs) text-danger">{fieldError('pickupStoreId')}</span> : null}
            </div>
          ) : null}
          {pickupStores.length === 0 ? (
            <p className="text-(length:--text-xs) text-fg-muted">Giỏ hiện chưa có cửa hàng nào đủ toàn bộ sản phẩm.</p>
          ) : null}
        </fieldset>

        <section
          aria-labelledby="customer-heading"
          className="grid gap-4 rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)"
        >
          <h2 id="customer-heading" className="text-(length:--text-lg) font-semibold">
            Người nhận
          </h2>
          {FIELDS.map((field) => {
            if (field.deliveryOnly && fulfillment === 'pickup') return null
            const error = fieldError(field.name)
            return (
              <div key={field.name} className="grid gap-1.5">
                <label htmlFor={field.name} className="text-(length:--text-sm) font-medium text-fg">
                  {field.label}
                  {field.required ? (
                    <span className="text-danger" aria-hidden>
                      {' '}
                      *
                    </span>
                  ) : null}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? 'text'}
                  required={field.required && fulfillment === 'delivery'}
                  defaultValue={defaults[field.name] ?? ''}
                  key={`${field.name}-${defaults[field.name] ?? ''}`}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${field.name}-error` : undefined}
                  className="min-h-11 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) focus-visible:border-brand"
                />
                {error ? (
                  <span id={`${field.name}-error`} className="text-(length:--text-xs) text-danger">
                    {error}
                  </span>
                ) : null}
              </div>
            )
          })}

          <fieldset className="grid gap-3 border-t border-border pt-4">
            <legend className="text-(length:--text-sm) font-semibold text-fg">
              Phương thức thanh toán
            </legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-md) border border-border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="paymentMethod" value="cod" defaultChecked className="size-4" />
              <span className="text-(length:--text-sm)">
                <strong>COD</strong> — thanh toán khi nhận hàng
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-md) border border-border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="paymentMethod" value="bank_transfer" className="size-4" />
              <span className="text-(length:--text-sm)">
                <strong>Chuyển khoản</strong> — giữ hàng có thời hạn
              </span>
            </label>
            {vnpayEnabled ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-md) border border-border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="radio" name="paymentMethod" value="vnpay" className="size-4" />
                <span className="text-(length:--text-sm)">
                  <strong>VNPay</strong> — thanh toán online qua cổng VNPay
                </span>
              </label>
            ) : null}
          </fieldset>
        </section>

        {/* Mobile collapsible summary */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold"
            aria-expanded={summaryOpen}
          >
            <span>Tổng {formatPrice(cart.total)}</span>
            <span className="text-fg-muted">{summaryOpen ? 'Ẩn' : 'Xem tóm tắt'}</span>
          </button>
          {summaryOpen ? <div className="mt-3">{summary}</div> : null}
          {submitBlock}
        </div>
      </div>

      <div className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        {summary}
        {submitBlock}
      </div>
    </form>
  )
}
