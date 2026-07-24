'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { removeCartItem, updateCartItem } from '@/lib/commerce/actions'
import type { ActionState, CartItemData } from '@/lib/commerce/types'
import { formatPrice } from '@/lib/format'

type CartItemRowProps = {
  item: CartItemData
}

const INITIAL_STATE: ActionState = { ok: true }

export function CartItemRow({ item }: CartItemRowProps) {
  const [updateState, updateAction, isUpdating] = useActionState(updateCartItem, INITIAL_STATE)
  const [removeState, removeAction, isRemoving] = useActionState(removeCartItem, INITIAL_STATE)
  const attributes = Object.values(item.attributes).join(' · ')
  const actionMessage = !updateState.ok ? updateState.message : !removeState.ok ? removeState.message : null

  return (
    <article className="grid gap-4 rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <Link
          href={`/products/${item.productSlug}`}
          className="text-(length:--text-lg) font-semibold text-fg hover:text-accent-active"
        >
          {item.productName}
        </Link>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">{attributes || item.sku}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <p className="font-semibold text-fg">{formatPrice(item.currentPrice)}</p>
          {item.priceChanged ? (
            <p className="text-(length:--text-sm) text-fg-subtle line-through">
              {formatPrice(item.priceAtAdd)}
            </p>
          ) : null}
        </div>
        {item.priceChanged ? (
          <p className="mt-2 text-(length:--text-sm) text-danger" role="alert">
            Giá đã thay đổi. Vui lòng kiểm tra lại trước khi thanh toán.
          </p>
        ) : null}
        {item.outOfStock ? (
          <p className="mt-2 text-(length:--text-sm) text-danger" role="alert">
            Sản phẩm hiện đã hết hàng.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 sm:justify-end">
        <form action={updateAction} className="flex items-end gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <label htmlFor={`quantity-${item.id}`} className="flex flex-col gap-1 text-(length:--text-sm) font-medium text-fg">
            Số lượng
            <input
              id={`quantity-${item.id}`}
              name="quantity"
              type="number"
              min="1"
              max="99"
              defaultValue={item.quantity}
              className="min-h-11 w-20 rounded-(--radius-md) border border-border bg-surface px-3 text-fg"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={isUpdating}>
            {isUpdating ? 'Đang cập nhật...' : 'Cập nhật'}
          </Button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" variant="ghost" disabled={isRemoving} className="text-danger hover:text-danger">
            {isRemoving ? 'Đang xóa...' : 'Xóa'}
          </Button>
        </form>
      </div>

      <div aria-live="polite" className="sm:col-span-2 text-(length:--text-sm) text-danger">
        {actionMessage}
      </div>
    </article>
  )
}
