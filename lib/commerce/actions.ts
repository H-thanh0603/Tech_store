'use server'

import { revalidatePath } from 'next/cache'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CART_COOKIE, getCartTokenHash, ORDER_ACCESS_COOKIE } from '@/lib/commerce/cookies'
import { createOpaqueToken, sha256Hex } from '@/lib/commerce/tokens'
import { isCommerceErrorCode, toUserMessage } from '@/lib/commerce/errors'
import { getRateLimitIdentity } from '@/lib/commerce/request-identity'
import type { ActionState, CommerceErrorCode } from '@/lib/commerce/types'
import { cartItemSchema, checkoutSchema, couponCodeSchema, trackingSchema } from '@/lib/commerce/validation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface RpcResult {
  code?: unknown
}

function validationError(fieldErrors?: Record<string, string[] | undefined>): ActionState {
  return {
    ok: false,
    code: 'VALIDATION_ERROR',
    message: toUserMessage('VALIDATION_ERROR'),
    fieldErrors,
  }
}

function rpcState(data: RpcResult | null, error: unknown): ActionState {
  const code: CommerceErrorCode | 'OK' =
    data?.code === 'OK'
      ? 'OK'
      : isCommerceErrorCode(data?.code)
        ? data.code
        : isCommerceErrorCode(error)
          ? error
          : 'INTERNAL_ERROR'
  return code === 'OK' ? { ok: true } : { ok: false, code, message: toUserMessage(code) }
}

function revalidateCart() {
  revalidatePath('/', 'layout')
  revalidatePath('/cart')
  revalidatePath('/products')
}

async function mutate(
  rpcName: 'cart_add_item' | 'cart_update_item' | 'cart_remove_item' | 'cart_apply_coupon',
  args: Record<string, string | number>,
): Promise<ActionState> {
  const { data, error } = await getSupabaseServerClient().rpc(rpcName, {
    p_cart_token_hash: await getCartTokenHash(),
    ...args,
  })
  const state = rpcState(data as RpcResult | null, error)
  if (state.ok) {
    revalidateCart()
  }
  return state
}

export async function addToCart(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = cartItemSchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }
  return mutate('cart_add_item', {
    p_variant_id: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
  })
}

export async function updateCartItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = cartItemSchema.safeParse({
    variantId: formData.get('itemId'),
    quantity: formData.get('quantity'),
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }
  return mutate('cart_update_item', {
    p_item_id: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
  })
}

export async function removeCartItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const itemId = formData.get('itemId')
  const parsed = cartItemSchema.pick({ variantId: true }).safeParse({ variantId: itemId })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }
  return mutate('cart_remove_item', { p_item_id: parsed.data.variantId })
}

export async function applyCoupon(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = couponCodeSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }
  return mutate('cart_apply_coupon', { p_code: parsed.data.code })
}

const ORDER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24,
}

export async function checkoutAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = checkoutSchema.safeParse({
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    customerEmail: formData.get('customerEmail'),
    province: formData.get('province'),
    district: formData.get('district'),
    ward: formData.get('ward'),
    streetAddress: formData.get('streetAddress'),
    note: formData.get('note'),
    paymentMethod: formData.get('paymentMethod'),
    idempotencyKey: formData.get('idempotencyKey'),
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const rawAccessToken = createOpaqueToken()
  // Prefer cookie-session client so place_order can read auth.uid() and attach user_id.
  const { createSupabaseAuthClient } = await import('@/lib/supabase/auth-server')
  const authClient = await createSupabaseAuthClient()
  const { data, error } = await authClient.rpc('place_order', {
    p_cart_token_hash: await getCartTokenHash(),
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_access_token_hash: await sha256Hex(rawAccessToken),
    p_customer: parsed.data,
    p_payment_method: parsed.data.paymentMethod,
    p_coupon_code: null,
  })
  const state = rpcState(data as RpcResult | null, error)
  if (!state.ok) {
    return state
  }

  const result = data as { orderCode?: string }
  if (!result.orderCode) {
    return { ok: false, code: 'INTERNAL_ERROR', message: toUserMessage('INTERNAL_ERROR') }
  }
  const cookieStore = await cookies()
  cookieStore.set(ORDER_ACCESS_COOKIE, rawAccessToken, ORDER_COOKIE_OPTIONS)
  // Converted cart keeps the old token hash; mint a fresh guest cart cookie so
  // subsequent add-to-cart calls do not hit CART_NOT_FOUND on the converted row.
  cookieStore.set(CART_COOKIE, createOpaqueToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  revalidatePath('/', 'layout')
  revalidatePath('/cart')
  redirect(`/orders/${encodeURIComponent(result.orderCode)}/confirmation`)
}

export async function trackOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = trackingSchema.safeParse({
    orderCode: formData.get('orderCode'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const rawAccessToken = createOpaqueToken()
  const requestHeaders = await headers()
  const ip = getRateLimitIdentity(requestHeaders, '') // fallback just gets IP if no session
  
  // Rate limiting with Redis
  try {
    const { trackingRateLimit } = await import('@/lib/rate-limit')
    const orderHash = await sha256Hex(parsed.data.orderCode)
    const ipIdentifier = `ip:${ip}`
    const orderIdentifier = `order:${orderHash}`
    
    // Check multiple budgets
    const [ipResult, orderResult] = await Promise.all([
      trackingRateLimit.limit(ipIdentifier),
      trackingRateLimit.limit(orderIdentifier)
    ])
    
    if (!ipResult.success || !orderResult.success) {
      return { ok: false, code: 'ORDER_NOT_FOUND', message: toUserMessage('ORDER_NOT_FOUND') }
    }
  } catch (e) {
    // If Redis fails, gracefully continue or block depending on strictness
    console.warn('Redis rate limit error:', e)
  }

  const requestIdentity = getRateLimitIdentity(requestHeaders, await getCartTokenHash())
  const { data, error } = await getSupabaseServerClient().rpc('order_track', {
    p_order_code: parsed.data.orderCode,
    p_phone: parsed.data.phone,
    p_identity_hash: await sha256Hex(requestIdentity),
    p_new_access_token_hash: await sha256Hex(rawAccessToken),
  })
  const state = rpcState(data as RpcResult | null, error)
  if (!state.ok) {
    return state.code === 'ORDER_NOT_FOUND' || state.code === 'RATE_LIMITED'
      ? { ok: false, code: 'ORDER_NOT_FOUND', message: toUserMessage('ORDER_NOT_FOUND') }
      : state
  }
  const result = data as { orderCode?: string }
  if (!result.orderCode) {
    return { ok: false, code: 'INTERNAL_ERROR', message: toUserMessage('INTERNAL_ERROR') }
  }
  const cookieStore = await cookies()
  cookieStore.set(ORDER_ACCESS_COOKIE, rawAccessToken, ORDER_COOKIE_OPTIONS)
  redirect(`/orders/${encodeURIComponent(result.orderCode)}`)
}
