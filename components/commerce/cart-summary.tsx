import Link from 'next/link'

import { formatPrice } from '@/lib/format'
import type { CartData } from '@/lib/commerce/types'

type CartSummaryProps = {
  cart: CartData
}

export function CartSummary({ cart }: CartSummaryProps) {
  const hasCartWarning = cart.items.some((item) => item.priceChanged || item.outOfStock)
  const isCheckoutDisabled = !cart.canCheckout || hasCartWarning
  const isFreeShipping = cart.shippingInfo?.isFree ?? true
  const freeThreshold = cart.shippingInfo?.freeThreshold ?? 0
  const remainingForFree = isFreeShipping ? 0 : Math.max(0, freeThreshold - cart.subtotal)

  return (
    <aside
      aria-labelledby="cart-summary-heading"
      className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-md)"
    >
      <h2
        id="cart-summary-heading"
        className="text-(length:--text-xl) font-semibold tracking-tight text-fg"
      >
        Tóm tắt đơn hàng
      </h2>
      <dl className="mt-5 flex flex-col gap-3 text-(length:--text-sm)">
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Tạm tính</dt>
          <dd className="font-medium tabular-nums text-fg">{formatPrice(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Giảm giá</dt>
          <dd className="font-medium tabular-nums text-success">
            -{formatPrice(cart.discountTotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Vận chuyển</dt>
          <dd className={`font-medium ${isFreeShipping ? 'text-success' : 'text-fg'}`}>
            {isFreeShipping ? 'Miễn phí' : formatPrice(cart.shippingTotal)}
          </dd>
        </div>
        {!isFreeShipping && remainingForFree > 0 && (
          <p className="text-(length:--text-xs) text-accent">
            Mua thêm {formatPrice(remainingForFree)} để được miễn phí vận chuyển
          </p>
        )}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-(length:--text-base)">
          <dt className="font-semibold text-fg">Tổng cộng</dt>
          <dd className="font-semibold tabular-nums text-fg">{formatPrice(cart.total)}</dd>
        </div>
      </dl>

      {isCheckoutDisabled ? (
        <p
          aria-live="polite"
          className="mt-4 rounded-(--radius-md) bg-danger-subtle px-3 py-2 text-(length:--text-sm) text-danger"
        >
          Kiểm tra lại giá và tình trạng hàng trước khi thanh toán.
        </p>
      ) : null}

      {isCheckoutDisabled ? (
        <span
          role="link"
          aria-disabled="true"
          tabIndex={-1}
          className="mt-5 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-(--radius-md) bg-surface-muted px-4 text-(length:--text-sm) font-semibold text-fg-muted"
        >
          Đến thanh toán
        </span>
      ) : (
        <Link
          href="/checkout"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-brand-hover"
        >
          Đến thanh toán
        </Link>
      )}
    </aside>
  )
}
