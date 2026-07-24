import { cookies } from 'next/headers'

import { createOpaqueToken, sha256Hex } from '@/lib/commerce/tokens'

export const CART_COOKIE = 'techstore_cart'
export const ORDER_ACCESS_COOKIE = 'techstore_order_access'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
}

export async function getOrCreateCartToken(): Promise<string> {
  const cookieStore = await cookies()
  const existingToken = cookieStore.get(CART_COOKIE)?.value
  if (existingToken) {
    return existingToken
  }

  const token = createOpaqueToken()
  cookieStore.set(CART_COOKIE, token, COOKIE_OPTIONS)
  return token
}

export async function getCartTokenHash(): Promise<string> {
  return sha256Hex(await getOrCreateCartToken())
}
