'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
  // Brute-force protection: 10 attempts / 15m per cart+IP (API-007)
  try {
    const headerList = await headers()
    const ip =
      headerList.get('x-real-ip')?.trim() ||
      headerList.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
      'unknown'
    const cartHash = await getCartTokenHash()
    const identity = `${cartHash}:${ip}`
    const { data: limited } = await getSupabaseServerClient().rpc('check_rate_limit', {
      p_action: 'coupon_apply',
      p_identity: identity,
      p_limit: 10,
      p_window_minutes: 15,
    })
    if (limited === true) {
      return { ok: false, code: 'RATE_LIMITED', message: toUserMessage('RATE_LIMITED') }
    }
  } catch {
    // fail-open
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
    province: formData.get('province') ?? '',
    district: formData.get('district') ?? '',
    ward: formData.get('ward') ?? '',
    streetAddress: formData.get('streetAddress') ?? '',
    note: formData.get('note'),
    paymentMethod: formData.get('paymentMethod'),
    idempotencyKey: formData.get('idempotencyKey'),
    fulfillmentMethod: formData.get('fulfillmentMethod'),
    pickupStoreId: formData.get('pickupStoreId') ?? '',
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const rawAccessToken = createOpaqueToken()
  // Persist the optional email on the open cart before place_order converts
  // it — this is what lets the abandoned-cart reminder reach customers who
  // dropped off mid-checkout.
  if (parsed.data.customerEmail) {
    await getSupabaseServerClient().rpc('cart_capture_email', {
      p_cart_token_hash: await getCartTokenHash(),
      p_email: parsed.data.customerEmail,
    })
  }
  // Prefer cookie-session client so place_order can read auth.uid() and attach user_id.
  const { createSupabaseAuthClient } = await import('@/lib/supabase/auth-server')
  const authClient = await createSupabaseAuthClient()
  const cartHash = await getCartTokenHash()
  const checkoutHeaders = await headers()
  const checkoutIdentity = getRateLimitIdentity(checkoutHeaders, cartHash)
  const { data, error } = await authClient.rpc('place_order', {
    p_cart_token_hash: cartHash,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_access_token_hash: await sha256Hex(rawAccessToken),
    p_customer: parsed.data,
    p_payment_method: parsed.data.paymentMethod,
    p_coupon_code: null,
    p_client_identity_hash: await sha256Hex(checkoutIdentity),
  })
  const state = rpcState(data as RpcResult | null, error)
  if (!state.ok) {
    return state
  }

  const result = data as { orderCode?: string; totals?: { total?: number } }
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

  if (parsed.data.paymentMethod === 'vnpay') {
    const { buildVnpayUrl } = await import('@/lib/commerce/vnpay')
    const { getSiteUrl } = await import('@/lib/site')
    const requestHeaders = await headers()
    const vnpayUrl = buildVnpayUrl({
      orderCode: result.orderCode,
      amountVnd: Number(result.totals?.total ?? 0),
      ipAddr:
        requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1',
      returnUrl: `${getSiteUrl()}/api/vnpay/return`,
    })
    if (!vnpayUrl) {
      return { ok: false, code: 'CONFIGURATION_ERROR', message: toUserMessage('CONFIGURATION_ERROR') }
    }
    redirect(vnpayUrl)
  }

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

const returnRequestSchema = z.object({
  orderCode: z.string().trim().min(4).max(24),
  phone: z.string().trim().min(8).max(20),
  reasonCode: z.enum(['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other']),
  customerNote: z.string().trim().max(1000).optional().default(''),
})

export async function requestReturn(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = returnRequestSchema.safeParse({
    orderCode: formData.get('orderCode'),
    phone: formData.get('phone'),
    reasonCode: formData.get('reasonCode'),
    customerNote: formData.get('customerNote') ?? '',
  })
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ORDER_ACCESS_COOKIE)?.value
  if (!accessToken) {
    return { ok: false, code: 'ORDER_NOT_FOUND', message: toUserMessage('ORDER_NOT_FOUND') }
  }

  const { data, error } = await getSupabaseServerClient().rpc('request_order_return', {
    p_order_code: parsed.data.orderCode,
    p_access_token_hash: await sha256Hex(accessToken),
    p_phone: parsed.data.phone,
    p_reason_code: parsed.data.reasonCode,
    p_customer_note: parsed.data.customerNote || null,
  })
  const state = rpcState(data as RpcResult | null, error)
  if (!state.ok) {
    return {
      ok: false,
      code: state.code,
      message: toUserMessage(
        state.code === 'RETURN_ALREADY_REQUESTED' ||
          state.code === 'NOT_RETURNABLE' ||
          state.code === 'RATE_LIMITED' ||
          state.code === 'ORDER_NOT_FOUND'
          ? state.code
          : 'INTERNAL_ERROR',
      ),
    }
  }
  revalidatePath(`/orders/${encodeURIComponent(parsed.data.orderCode)}`)
  return { ok: true, message: 'Yêu cầu trả hàng đã gửi. Shop sẽ liên hệ trong 24 giờ.' }
}
