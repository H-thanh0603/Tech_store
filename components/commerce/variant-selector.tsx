'use client'

import { useActionState, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { canAddToCart, resolveSelectedVariant, variantLabel } from '@/lib/catalog/variant-selection'
import type { ProductVariantData } from '@/lib/catalog/types'
import { addToCart } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'
import { formatPrice } from '@/lib/format'

type VariantSelectorProps = {
  variants: ProductVariantData[]
}

const INITIAL_STATE: ActionState = { ok: true }

export function VariantSelector({ variants }: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(variants[0]?.id)
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-(length:--text-2xl) font-semibold text-fg">{formatPrice(selected.price)}</p>
        {selected.hasDiscount ? (
          <>
            <p className="text-(length:--text-base) text-fg-subtle line-through">
              {formatPrice(selected.regularPrice)}
            </p>
            <Badge tone="danger">Giảm giá</Badge>
          </>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-(length:--text-sm) font-medium text-fg">Phiên bản</legend>
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
                  className={[
                    'inline-flex min-h-(--size-touch) items-center gap-2 rounded-(--radius-md) border px-3 text-(length:--text-sm)',
                    'transition-colors duration-(--duration-fast)',
                    isSelected
                      ? 'border-accent bg-accent-subtle text-accent-active'
                      : 'border-border bg-surface text-fg hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <span>{variantLabel(variant)}</span>
                  {outOfStock ? (
                    <span className="text-(length:--text-xs) text-fg-subtle">Hết hàng</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <p className="text-(length:--text-sm)" aria-live="polite">
        {buyable ? (
          <span className="text-success">Còn hàng · {selected.availableStock} sản phẩm</span>
        ) : (
          <span className="text-danger">Hết hàng</span>
        )}
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="variantId" value={selected.id} />
        <label htmlFor="product-quantity" className="flex max-w-32 flex-col gap-1 text-(length:--text-sm) font-medium text-fg">
          Số lượng
          <input
            id="product-quantity"
            name="quantity"
            type="number"
            min="1"
            max="99"
            defaultValue="1"
            disabled={!buyable || isPending}
            className="min-h-11 rounded-(--radius-md) border border-border bg-surface px-3 text-fg disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <Button type="submit" disabled={!buyable || isPending} className="w-full sm:w-auto">
          {!buyable ? 'Tạm hết hàng' : isPending ? 'Đang thêm...' : 'Thêm vào giỏ'}
        </Button>
      </form>

      <p
        aria-live="polite"
        className={state.ok ? 'text-(length:--text-sm) text-success' : 'text-(length:--text-sm) text-danger'}
      >
        {state.message}
      </p>
    </div>
  )
}
