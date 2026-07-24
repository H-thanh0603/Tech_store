'use server'

import { revalidatePath } from 'next/cache'

import { getCartTokenHash } from '@/lib/commerce/cookies'
import { isCommerceErrorCode, toUserMessage } from '@/lib/commerce/errors'
import type { ActionState, CommerceErrorCode } from '@/lib/commerce/types'
import { cartItemSchema, couponCodeSchema } from '@/lib/commerce/validation'
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
