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
 *
 * Listens for `cart:updated` (fired by the assistant widget after any
 * turn whose snapshot changed) so the header badge refreshes without
 * a page reload.
 */
export function MiniCartContainer() {
  const [cart, setCart] = useState<CartData>(emptyCart)

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/cart', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : emptyCart))
        .then((data: CartData) => {
          if (active) setCart(data)
        })
        .catch(() => {})
    }
    load()
    window.addEventListener('cart:updated', load)
    return () => {
      active = false
      window.removeEventListener('cart:updated', load)
    }
  }, [])

  return <MiniCart cart={cart} />
}
