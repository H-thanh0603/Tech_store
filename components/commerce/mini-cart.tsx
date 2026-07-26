'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { IconCart } from '@/components/ui/icons'
import { track } from '@/lib/analytics'
import { formatPrice } from '@/lib/format'
import type { CartData } from '@/lib/commerce/types'

type MiniCartProps = {
  cart: CartData
}

export function MiniCart({ cart }: MiniCartProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const preview = cart.items.slice(0, 4)

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border bg-bg-elevated px-3 text-(length:--text-sm) font-semibold text-fg shadow-(--shadow-sm) transition-colors hover:border-border-strong"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) track('mini_cart_open', { itemCount: cart.itemCount })
            return next
          })
        }}
      >
        <IconCart size={18} />
        <span className="hidden sm:inline">Giỏ</span>
        {cart.itemCount > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-(length:--text-xs) font-semibold tabular-nums text-accent-fg">
            {cart.itemCount > 99 ? '99+' : cart.itemCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="dialog"
          aria-label="Giỏ hàng nhanh"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-(--radius-lg) border border-border bg-bg-elevated p-3 shadow-(--shadow-lg)"
        >
          {cart.items.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="font-semibold text-fg">Giỏ trống</p>
              <p className="mt-1 text-(length:--text-sm) text-fg-muted">Thêm sản phẩm để thanh toán.</p>
              <Link
                href="/products"
                className="mt-3 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-brand"
                onClick={() => setOpen(false)}
              >
                Xem catalog →
              </Link>
            </div>
          ) : (
            <>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {preview.map((item) => (
                  <li key={item.id} className="flex gap-3 rounded-(--radius-md) p-1.5 hover:bg-surface-muted">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="relative size-12 shrink-0 overflow-hidden rounded-(--radius-sm) bg-surface-muted"
                      onClick={() => setOpen(false)}
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="line-clamp-1 text-(length:--text-sm) font-medium text-fg hover:text-brand"
                        onClick={() => setOpen(false)}
                      >
                        {item.productName}
                      </Link>
                      <p className="text-(length:--text-xs) text-fg-muted">
                        ×{item.quantity} · {formatPrice(item.lineTotal)}
                      </p>
                      {item.outOfStock ? (
                        <p className="text-(length:--text-xs) text-danger">Hết hàng</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {cart.items.length > preview.length ? (
                <p className="mt-2 text-center text-(length:--text-xs) text-fg-subtle">
                  +{cart.items.length - preview.length} sản phẩm khác
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-(length:--text-sm)">
                <span className="text-fg-muted">Tạm tính</span>
                <span className="font-semibold tabular-nums">{formatPrice(cart.total)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-border text-(length:--text-sm) font-semibold text-fg hover:bg-surface-muted"
                  onClick={() => setOpen(false)}
                >
                  Xem giỏ
                </Link>
                <Link
                  href="/checkout"
                  className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
                  onClick={() => {
                    track('begin_checkout', { itemCount: cart.itemCount, total: cart.total })
                    setOpen(false)
                  }}
                >
                  Thanh toán
                </Link>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
