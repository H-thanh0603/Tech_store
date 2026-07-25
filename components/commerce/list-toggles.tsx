'use client'

import { useState, useSyncExternalStore } from 'react'

import { IconCompare, IconHeart } from '@/components/ui/icons'
import { useOptionalToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import {
  getCompareSnapshot,
  getServerListSnapshot,
  getWishlistSnapshot,
  subscribeLists,
  toggleCompare,
  toggleWishlist,
  toStoredRef,
} from '@/lib/customer/local-lists'

type ProductLike = {
  id: string
  slug: string
  name: string
  brandName?: string | null
  minPrice: number
  imageUrl?: string | null
  categorySlug: string
}

export function ListToggles({
  product,
  compact = false,
}: {
  product: ProductLike
  compact?: boolean
}) {
  const ref = toStoredRef(product)
  const wishlist = useSyncExternalStore(subscribeLists, getWishlistSnapshot, getServerListSnapshot)
  const compareList = useSyncExternalStore(subscribeLists, getCompareSnapshot, getServerListSnapshot)
  const wish = wishlist.some((p) => p.id === product.id)
  const compare = compareList.some((p) => p.id === product.id)
  const [message, setMessage] = useState<string | null>(null)
  const { toast } = useOptionalToast()

  function onWish(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const active = toggleWishlist(ref)
    track('wishlist_toggle', { productId: product.id, active })
    const msg = active ? 'Đã thêm wishlist' : 'Đã bỏ wishlist'
    setMessage(msg)
    toast({ title: msg, description: product.name, tone: 'success' })
  }

  function onCompare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = toggleCompare(ref)
    track('compare_toggle', { productId: product.id, active: result.active })
    if (result.full) {
      setMessage('So sánh tối đa 4 sản phẩm')
      toast({ title: 'So sánh tối đa 4 sản phẩm', tone: 'error' })
    } else {
      const msg = result.active ? 'Đã thêm so sánh' : 'Đã bỏ so sánh'
      setMessage(msg)
      toast({ title: msg, description: product.name, tone: 'success' })
    }
  }

  const btn =
    'relative z-10 inline-flex min-h-9 min-w-9 items-center justify-center rounded-(--radius-md) border border-border bg-bg-elevated/95 text-(length:--text-xs) font-semibold shadow-(--shadow-sm) backdrop-blur-sm hover:border-border-strong'

  return (
    <div className={compact ? 'flex gap-1' : 'flex flex-col gap-1'}>
      <div className="flex gap-1">
        <button
          type="button"
          className={`${btn} ${wish ? 'border-brand text-brand' : 'text-fg-muted'}`}
          aria-pressed={wish}
          aria-label={wish ? 'Bỏ khỏi wishlist' : 'Thêm vào wishlist'}
          onClick={onWish}
          title="Wishlist"
        >
          <IconHeart size={16} />
        </button>
        <button
          type="button"
          className={`${btn} ${compare ? 'border-brand text-brand' : 'text-fg-muted'}`}
          aria-pressed={compare}
          aria-label={compare ? 'Bỏ khỏi so sánh' : 'Thêm so sánh'}
          onClick={onCompare}
          title="So sánh"
        >
          <IconCompare size={16} />
        </button>
      </div>
      {message ? (
        <p className="sr-only" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}

export function useListCounts() {
  const wishlist = useSyncExternalStore(subscribeLists, getWishlistSnapshot, getServerListSnapshot)
  const compareList = useSyncExternalStore(subscribeLists, getCompareSnapshot, getServerListSnapshot)
  return { wishCount: wishlist.length, compareCount: compareList.length }
}
