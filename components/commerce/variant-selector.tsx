'use client'

import { useActionState, useId, useState } from 'react'

import { StickyPurchaseBar } from '@/components/commerce/sticky-purchase-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Price } from '@/components/ui/price'
import { canAddToCart, resolveSelectedVariant, variantLabel } from '@/lib/catalog/variant-selection'
import type { ProductVariantData } from '@/lib/catalog/types'
import { addToCart } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

type VariantSelectorProps = {
  variants: ProductVariantData[]
  productName?: string
  showStickyBar?: boolean
}

const INITIAL_STATE: ActionState = { ok: true }

export function VariantSelector({
  variants,
  productName = 'Sản phẩm',
  showStickyBar = true,
}: VariantSelectorProps) {
  const formId = useId()
  const [selectedId, setSelectedId] = useState<string | undefined>(variants[0]?.id)
  const [qty, setQty] = useState(1)
  const [state, formAction, isPending] = useActionState(addToCart, INITIAL_STATE)
  const selected = resolveSelectedVariant(variants, selectedId)
  const buyable = canAddToCart(selected)

  if (!selected) {
    return (
      <p className="text-(length:--text-sm) text-fg-muted">
        Sản phẩm hiện chưa có phiên bản để bán.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Price
          amount={selected.price}
          compareAt={selected.hasDiscount ? selected.regularPrice : null}
          size="lg"
        />
        {selected.hasDiscount ? (
          <div className="mt-2">
            <Badge tone="danger">Đang giảm giá</Badge>
          </div>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-(length:--text-sm) font-semibold text-fg">Phiên bản</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selected.id
              const outOfStock = !variant.inStock
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  aria-pressed={isSelected}
                  disabled={outOfStock && !isSelected}
                  className={[
                    'inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border px-3 text-(length:--text-sm) font-medium transition-colors',
                    isSelected
                      ? 'border-brand bg-brand-soft text-brand'
                      : outOfStock
                        ? 'cursor-not-allowed border-border bg-surface-muted text-fg-subtle opacity-70'
                        : 'border-border bg-bg-primary text-fg hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <span>{variantLabel(variant)}</span>
                  {outOfStock ? (
                    <span className="text-(length:--text-xs)">Hết</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <p className="text-(length:--text-sm)" aria-live="polite">
        {buyable ? (
          <span className="font-medium text-success">
            Còn hàng · {selected.availableStock} sản phẩm
          </span>
        ) : (
          <span className="font-medium text-danger">Hết hàng — không thể thêm vào giỏ</span>
        )}
      </p>

      <div className="rounded-(--radius-md) border border-border bg-bg-secondary/50 p-3 text-(length:--text-xs) text-fg-muted">
        <ul className="space-y-1">
          <li>· Giao hàng / COD hoặc chuyển khoản</li>
          <li>· Giữ hàng khi đặt thành công</li>
          <li>· Theo dõi đơn bằng mã + SĐT</li>
        </ul>
      </div>

      <form id={formId} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="variantId" value={selected.id} />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="product-quantity"
              className="mb-1.5 block text-(length:--text-sm) font-medium text-fg"
            >
              Số lượng
            </label>
            <div className="inline-flex overflow-hidden rounded-(--radius-md) border border-border">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center bg-bg-elevated text-fg hover:bg-surface-muted disabled:opacity-40"
                aria-label="Giảm số lượng"
                disabled={!buyable || qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                id="product-quantity"
                name="quantity"
                type="number"
                min={1}
                max={99}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                disabled={!buyable || isPending}
                className="min-h-11 w-14 border-x border-border bg-bg-primary text-center text-(length:--text-sm) tabular-nums disabled:opacity-50"
              />
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center bg-bg-elevated text-fg hover:bg-surface-muted disabled:opacity-40"
                aria-label="Tăng số lượng"
                disabled={!buyable || qty >= 99}
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                +
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={!buyable || isPending}
            className="min-h-11 flex-1 sm:flex-none sm:px-8"
          >
            {!buyable ? 'Tạm hết hàng' : isPending ? 'Đang thêm…' : 'Thêm vào giỏ'}
          </Button>
        </div>
      </form>

      <p
        aria-live="polite"
        className={
          state.ok
            ? 'text-(length:--text-sm) font-medium text-success'
            : 'text-(length:--text-sm) font-medium text-danger'
        }
      >
        {state.message}
      </p>

      {showStickyBar ? (
        <StickyPurchaseBar
          productName={productName}
          price={selected.price}
          canBuy={buyable}
          formId={formId}
          pending={isPending}
        />
      ) : null}
    </div>
  )
}
