import Link from 'next/link'

import { CartItemRow } from '@/components/commerce/cart-item-row'
import { CartSummary } from '@/components/commerce/cart-summary'
import { CouponForm } from '@/components/commerce/coupon-form'
import type { CartData } from '@/lib/commerce/types'

type CartPageContentProps = {
  cart: CartData
}

export function CartPageContent({ cart }: CartPageContentProps) {
  if (cart.items.length === 0) {
    return (
      <section
        aria-labelledby="cart-heading"
        className="mx-auto flex max-w-lg flex-col items-start gap-5 py-10 sm:py-16"
      >
        <div className="grid size-14 place-items-center rounded-(--radius-lg) border border-border bg-surface-raised text-(length:--text-2xl) shadow-(--shadow-sm)">
          🛒
        </div>
        <p className="eyebrow">Giỏ hàng</p>
        <h1 id="cart-heading" className="text-(length:--text-3xl) font-semibold tracking-tight text-fg">
          Giỏ hàng đang trống
        </h1>
        <p className="text-(length:--text-base) leading-relaxed text-fg-muted">
          Chọn thiết bị theo nhu cầu — học tập, lập trình, sáng tạo — rồi quay lại đây để thanh
          toán guest checkout.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
          >
            Xem sản phẩm
          </Link>
          <Link
            href="/#need-selector"
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold text-fg"
          >
            Chọn theo nhu cầu
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="cart-heading" className="flex flex-col gap-6">
      <div className="border-b border-border pb-5">
        <p className="eyebrow">Giỏ hàng</p>
        <h1
          id="cart-heading"
          className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight text-fg"
        >
          Sản phẩm đã chọn
        </h1>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          {cart.itemCount} dòng · kiểm tra số lượng và tồn kho trước khi đặt
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
          <Link
            href="/products"
            className="text-(length:--text-sm) font-semibold text-brand hover:text-brand-hover"
          >
            ← Tiếp tục mua sắm
          </Link>
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          <CouponForm appliedCode={cart.appliedCouponCode ?? undefined} />
          <CartSummary cart={cart} />
        </div>
      </div>
    </section>
  )
}
