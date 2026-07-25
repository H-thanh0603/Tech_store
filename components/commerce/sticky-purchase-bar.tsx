'use client'

import { formatPrice } from '@/lib/format'

type StickyPurchaseBarProps = {
  productName: string
  price: number
  canBuy: boolean
  formId: string
  pending?: boolean
}

/** Mobile sticky CTA — links to the main add-to-cart form via form attribute. */
export function StickyPurchaseBar({
  productName,
  price,
  canBuy,
  formId,
  pending,
}: StickyPurchaseBarProps) {
  return (
    <div className="above-bottom-nav fixed inset-x-0 z-40 border-t border-border bg-bg-elevated/95 p-3 shadow-(--shadow-lg) backdrop-blur-md lg:hidden">
      <div className="container-store flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-(length:--text-xs) text-fg-muted">{productName}</p>
          <p className="text-(length:--text-base) font-semibold tabular-nums text-fg">
            {formatPrice(price)}
          </p>
        </div>
        <button
          type="submit"
          form={formId}
          disabled={!canBuy || pending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!canBuy ? 'Hết hàng' : pending ? 'Đang thêm…' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  )
}
