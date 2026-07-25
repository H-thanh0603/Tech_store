'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics'
import { pushRecentlyViewed, toStoredRef } from '@/lib/customer/local-lists'

type Props = {
  product: {
    id: string
    slug: string
    name: string
    brandName?: string | null
    minPrice: number
    imageUrl?: string | null
    categorySlug: string
  }
}

/** Records product view analytics + recently-viewed list (client only). */
export function ProductViewTracker({ product }: Props) {
  useEffect(() => {
    track('product_viewed', {
      productId: product.id,
      slug: product.slug,
      category: product.categorySlug,
    })
    pushRecentlyViewed(toStoredRef(product))
  }, [product])

  return null
}
