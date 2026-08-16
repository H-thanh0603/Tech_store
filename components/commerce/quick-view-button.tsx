'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'

import { Price } from '@/components/ui/price'
import { useOptionalToast } from '@/components/ui/toast'
import { addToCart } from '@/lib/commerce/actions'
import type { ActionState } from '@/lib/commerce/types'

interface QuickViewData {
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  imageAlt: string
  minPrice: number
  hasDiscount: boolean
  inStock: boolean
  categoryName: string | null
  variantId: string | null
  variantPrice: number | null
  specs: Array<{ group: string; label: string; value: string }>
}

const INITIAL_STATE: ActionState = { ok: true }

export function QuickViewButton({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<QuickViewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { toast } = useOptionalToast()

  const openDialog = useCallback(() => {
    setOpen(true)
    if (data || loading) return
    setLoading(true)
    fetch(`/api/catalog/quick-view?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((json: QuickViewData) => setData(json))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug, data, loading])

  const closeDialog = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Toast + close run in the action callback (event-style), not in an effect.
  const [, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await addToCart(prev, formData)
      if (result.ok) {
        toast({ title: 'Đã thêm vào giỏ', description: data?.name, tone: 'success' })
        closeDialog()
      } else {
        toast({ title: 'Không thêm được vào giỏ', description: result.message, tone: 'error' })
      }
      return result
    },
    INITIAL_STATE,
  )

  // Escape closes, Tab cycles inside the dialog (focus trap).
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeDialog])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-md) border border-border bg-bg-elevated/95 px-3 text-(length:--text-xs) font-bold text-fg shadow-sm backdrop-blur transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span aria-hidden>👁</span> Xem nhanh
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Xem nhanh ${name}`}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-(--radius-xl) border border-border bg-bg-elevated shadow-2xl animate-scale-in"
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Đóng xem nhanh"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-border bg-bg-elevated text-fg-muted transition-colors hover:text-fg"
            >
              ✕
            </button>

            {loading ? (
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="aspect-[4/3] animate-pulse rounded-(--radius-md) bg-bg-secondary" />
                <div className="space-y-3">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-bg-secondary" />
                  <div className="h-6 w-1/2 animate-pulse rounded bg-bg-secondary" />
                  <div className="h-24 animate-pulse rounded bg-bg-secondary" />
                </div>
              </div>
            ) : error || !data ? (
              <div className="p-10 text-center text-(length:--text-sm) text-fg-muted">
                Không tải được dữ liệu.{' '}
                <Link href={`/products/${slug}`} className="font-semibold text-brand underline">
                  Xem trang sản phẩm
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 p-6 sm:grid-cols-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-md) bg-bg-secondary/60">
                  {data.imageUrl ? (
                    <Image
                      src={data.imageUrl}
                      alt={data.imageAlt}
                      width={800}
                      height={600}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  {data.categoryName ? (
                    <p className="text-(length:--text-xs) font-bold uppercase tracking-[0.12em] text-brand">
                      {data.categoryName}
                    </p>
                  ) : null}
                  <h3 className="text-(length:--text-xl) font-bold leading-snug tracking-tight">
                    {data.name}
                  </h3>
                  <Price amount={data.variantPrice ?? data.minPrice} size="lg" />

                  {data.specs.length > 0 ? (
                    <ul className="space-y-1.5 border-t border-border pt-3">
                      {data.specs.map((spec) => (
                        <li
                          key={`${spec.group}-${spec.label}`}
                          className="flex justify-between gap-3 text-(length:--text-xs)"
                        >
                          <span className="text-fg-muted">{spec.label}</span>
                          <span className="text-right font-medium">{spec.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <form action={formAction} className="mt-auto flex flex-col gap-2 pt-2">
                    <input type="hidden" name="variantId" value={data.variantId ?? ''} />
                    <input type="hidden" name="quantity" value="1" />
                    <button
                      type="submit"
                      disabled={isPending || !data.variantId || !data.inStock}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending
                        ? 'Đang thêm…'
                        : data.variantId && data.inStock
                          ? 'Thêm vào giỏ'
                          : 'Hết hàng'}
                    </button>
                    <Link
                      href={`/products/${data.slug}`}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold text-fg transition-colors hover:border-brand hover:text-brand"
                    >
                      Xem chi tiết
                    </Link>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
