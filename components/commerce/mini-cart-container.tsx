'use client'

import { useEffect, useState } from 'react'

import { MiniCart } from '@/components/commerce/mini-cart'
import type { CartData } from '@/lib/commerce/types'

const emptyCart: CartData = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  total: 0,
  appliedCouponCode: null,
  canCheckout: false,
  shippingInfo: null,
}

/**
 * Client wrapper around MiniCart that fetches the cart on mount.
 * Keeps cart-cookie reads out of the server layout so catalog pages
 * stay ISR-cacheable; the badge count pops in after hydration.
 */
export function MiniCartContainer() {
  const [cart, setCart] = useState<CartData>(emptyCart)

  useEffect(() => {
    let active = true
    fetch('/api/cart', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : emptyCart))
      .then((data: CartData) => {
        if (active) setCart(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return <MiniCart cart={cart} />
}
