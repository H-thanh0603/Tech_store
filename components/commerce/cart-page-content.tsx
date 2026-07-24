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
      <section aria-labelledby="cart-heading" className="mx-auto flex max-w-xl flex-col items-start gap-4 py-12">
        <p className="text-(length:--text-sm) font-medium uppercase tracking-wide text-fg-subtle">Giỏ hàng</p>
        <h1 id="cart-heading" className="text-(length:--text-3xl) font-semibold tracking-tight text-fg">
          Giỏ hàng đang trống
        </h1>
        <p className="text-fg-muted">Khám phá thiết bị phù hợp cho công việc và giải trí.</p>
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-(length:--text-sm) font-medium text-accent-fg transition-colors duration-(--duration-fast) hover:bg-accent-hover active:bg-accent-active"
        >
          Xem sản phẩm
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="cart-heading" className="flex flex-col gap-6">
      <div>
        <p className="text-(length:--text-sm) font-medium uppercase tracking-wide text-fg-subtle">Giỏ hàng</p>
        <h1 id="cart-heading" className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight text-fg">
          Sản phẩm đã chọn
        </h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <CouponForm appliedCode={cart.appliedCouponCode ?? undefined} />
          <CartSummary cart={cart} />
        </div>
      </div>
    </section>
  )
}
