import { getExistingCartTokenHash } from '@/lib/commerce/cookies'
import { cookies } from 'next/headers'

import { ORDER_ACCESS_COOKIE } from '@/lib/commerce/cookies'
import { sha256Hex } from '@/lib/commerce/tokens'
import type { CartData, CartItemData, OrderConfirmationData } from '@/lib/commerce/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface CartRpcItem {
  id: string
  variantId: string
  productName: string
  productSlug: string
  sku: string
  attributes: Record<string, unknown> | null
  quantity: number | string
  priceAtAdd: number | string
  currentPrice: number | string
  lineTotal: number | string
  availableStock: number | string
  priceChanged: boolean
  outOfStock: boolean
  imageUrl: string | null
  imageAlt: string | null
}

interface CartRpcData extends Omit<CartData, 'items'> {
  items: CartRpcItem[]
}

function numberValue(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapItem(item: CartRpcItem): CartItemData {
  const attributes = Object.fromEntries(
    Object.entries(item.attributes ?? {}).map(([key, value]) => [key, String(value)]),
  )
  return {
    ...item,
    attributes,
    quantity: numberValue(item.quantity),
    priceAtAdd: numberValue(item.priceAtAdd),
    currentPrice: numberValue(item.currentPrice),
    lineTotal: numberValue(item.lineTotal),
    availableStock: numberValue(item.availableStock),
  }
}

function emptyCart(): CartData {
  return {
    items: [],
    itemCount: 0,
    subtotal: 0,
    discountTotal: 0,
    shippingTotal: 0,
    total: 0,
    appliedCouponCode: null,
    canCheckout: false,
  }
}

export async function getCart(): Promise<CartData> {
  const tokenHash = await getExistingCartTokenHash()
  if (!tokenHash) {
    return emptyCart()
  }

  const { data, error } = await getSupabaseServerClient().rpc('cart_get', {
    p_cart_token_hash: tokenHash,
  })
  if (error || !data || typeof data !== 'object') {
    throw new Error('Failed to load cart')
  }

  const cart = data as CartRpcData
  return {
    ...emptyCart(),
    ...cart,
    items: (cart.items ?? []).map(mapItem),
    itemCount: numberValue(cart.itemCount),
    subtotal: numberValue(cart.subtotal),
    discountTotal: numberValue(cart.discountTotal),
    shippingTotal: 0,
    total: numberValue(cart.total),
  }
}

export async function getCartItemCount(): Promise<number> {
  return (await getCart()).itemCount
}

export async function getOrderByAccess(orderCode: string): Promise<OrderConfirmationData | null> {
  const token = (await cookies()).get(ORDER_ACCESS_COOKIE)?.value
  if (!token) return null
  const { data, error } = await getSupabaseServerClient().rpc('order_get_by_access', {
    p_order_code: orderCode,
    p_access_token_hash: await sha256Hex(token),
  })
  if (error || !data || data.code !== 'OK') return null
  return data as OrderConfirmationData
}
