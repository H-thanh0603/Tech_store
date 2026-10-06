/**
 * Chat cart backend + gates (port of commerce-agents cart flow + gates.py).
 *
 * The widget shares the guest cart with the storefront via the
 * `techstore_cart` cookie: the route parses it from the Cookie header
 * (stateless-safe), hashes it, and hands the hash to the turn loop.
 * Writes go through the same anon cart RPCs as the website; the model only
 * sees DTOs. Checkout hands off: start_checkout returns the /checkout URL +
 * summary — the host page completes payment, the model never places orders.
 */

import { getProductBySlug } from '@/lib/catalog/queries'
import { createOpaqueToken } from '@/lib/commerce/tokens'
import { CART_COOKIE } from '@/lib/commerce/cookies'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { resolveSeenOrSlug } from './backend'

export const MAX_CART_QTY = 10

export interface ChatCartLine {
  variant_id: string
  product_name: string
  slug: string
  sku: string
  quantity: number
  unit_price: number
  line_total: number
  available_stock: number
}

export interface ChatCartView {
  item_count: number
  subtotal: number
  items: ChatCartLine[]
}

export type CartRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

async function defaultRpc(): Promise<CartRpcClient> {
  return getSupabaseServerClient() as unknown as CartRpcClient
}

/** Parse the opaque cart token from a Cookie header value. */
export function parseCartToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() === CART_COOKIE) {
      // Malformed percent-encoding must not 500 the route: skip the cookie.
      let value: string
      try {
        value = decodeURIComponent(part.slice(idx + 1).trim())
      } catch {
        return null
      }
      return value || null
    }
  }
  return null
}

export function ensureCartToken(existing: string | null): { token: string; isNew: boolean } {
  if (existing) return { token: existing, isNew: false }
  return { token: createOpaqueToken(), isNew: true }
}

export function cartSetCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${CART_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}; HttpOnly`
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

interface CartRpcItem {
  variantId: string
  productName: string
  productSlug: string
  sku: string
  quantity: number | string
  currentPrice: number | string
  lineTotal: number | string
  availableStock: number | string
}

export async function getChatCart(
  cartTokenHash: string,
  rpc?: CartRpcClient,
): Promise<ChatCartView> {
  const client = rpc ?? (await defaultRpc())
  const { data, error } = await client.rpc('cart_get', { p_cart_token_hash: cartTokenHash })
  if (error || !data || typeof data !== 'object') {
    return { item_count: 0, subtotal: 0, items: [] }
  }
  const cart = data as { itemCount?: unknown; subtotal?: unknown; items?: CartRpcItem[] }
  const items = (cart.items ?? []).map((item) => ({
    variant_id: String(item.variantId ?? ''),
    product_name: String(item.productName ?? ''),
    slug: String(item.productSlug ?? ''),
    sku: String(item.sku ?? ''),
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.currentPrice),
    line_total: toNumber(item.lineTotal),
    available_stock: toNumber(item.availableStock),
  }))
  return { item_count: toNumber(cart.itemCount), subtotal: toNumber(cart.subtotal), items }
}

export type CartWriteResult =
  | { ok: true; cart: ChatCartView }
  | { ok: false; code: string; message: string }

function rpcCode(data: unknown): string | null {
  if (data && typeof data === 'object' && 'code' in data && typeof (data as { code: unknown }).code === 'string') {
    return (data as { code: string }).code
  }
  return null
}

const CART_MESSAGES: Record<string, string> = {
  OUT_OF_STOCK: 'Số lượng vượt tồn kho hiện có.',
  PRICE_CHANGED: 'Giá vừa thay đổi — xem lại giỏ trước khi tiếp tục.',
  PRODUCT_UNAVAILABLE: 'Sản phẩm hiện không khả dụng.',
  CART_EMPTY: 'Giỏ hàng đang trống.',
  ITEM_NOT_FOUND: 'Món này không còn trong giỏ.',
}

async function writeCart(
  rpcName: 'cart_add_item' | 'cart_update_item' | 'cart_remove_item',
  args: Record<string, unknown>,
  cartTokenHash: string,
  rpc?: CartRpcClient,
): Promise<CartWriteResult> {
  const client = rpc ?? (await defaultRpc())
  const { data, error } = await client.rpc(rpcName, { p_cart_token_hash: cartTokenHash, ...args })
  if (error) return { ok: false, code: 'INTERNAL_ERROR', message: 'Giỏ hàng tạm lỗi, thử lại sau.' }
  const code = rpcCode(data)
  if (code && code !== 'OK') {
    return { ok: false, code, message: CART_MESSAGES[code] ?? 'Thao tác giỏ hàng thất bại.' }
  }
  return { ok: true, cart: await getChatCart(cartTokenHash, client) }
}

export interface ResolvedVariant {
  variant_id: string
  slug: string
  product_name: string
  unit_price: number
  available_stock: number
}

/**
 * Provenance + variant gate: opaque variant ids must have been returned by a
 * tool this turn; a slug resolves only when the product has exactly one
 * variant (otherwise the customer must pick a variant from details first).
 */
export async function resolveCartVariant(
  identifier: string,
  seenIdToSlug?: Map<string, string>,
): Promise<{ variant: ResolvedVariant | null; error?: string }> {
  const trimmed = String(identifier ?? '').trim()
  if (!trimmed) return { variant: null, error: 'Thiếu identifier sản phẩm.' }
  const seen = seenIdToSlug?.get(trimmed)
  const slug = seen ?? resolveSeenOrSlug(trimmed, seenIdToSlug)
  if (!slug) {
    return { variant: null, error: 'Chỉ dùng id biến thể do tool trả về trong cuộc trò chuyện.' }
  }
  const detail = await getProductBySlug(slug)
  if (!detail) return { variant: null, error: 'Không tìm thấy sản phẩm.' }
  if (UUID_LIKE.test(trimmed) && !seen) {
    return { variant: null, error: 'Chỉ dùng id biến thể do tool trả về trong cuộc trò chuyện.' }
  }
  const match = seen && UUID_LIKE.test(trimmed)
    ? detail.variants.find((v) => v.id === trimmed)
    : detail.variants.length === 1
      ? detail.variants[0]
      : null
  if (!match) {
    return {
      variant: null,
      error: 'Sản phẩm có nhiều biến thể — xem chi tiết và chọn đúng biến thể (màu/dung tích) trước.',
    }
  }
  return {
    variant: {
      variant_id: match.id,
      slug: detail.slug,
      product_name: detail.name,
      unit_price: match.salePrice ?? match.price,
      available_stock: match.availableStock,
    },
  }
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Quantity gate: integer 1..MAX_CART_QTY and within live available stock. */
export function validateQuantity(qty: number, availableStock: number): string | null {
  const q = Math.floor(Number(qty))
  if (!Number.isFinite(q) || q < 1 || q > MAX_CART_QTY) {
    return `Số lượng phải là số nguyên 1–${MAX_CART_QTY}.`
  }
  if (q > availableStock) {
    return `Chỉ còn ${availableStock} sản phẩm sẵn hàng.`
  }
  return null
}

export async function chatAddToCart(
  cartTokenHash: string,
  identifier: string,
  quantity: number,
  seenIdToSlug?: Map<string, string>,
  rpc?: CartRpcClient,
): Promise<CartWriteResult> {
  const { variant, error } = await resolveCartVariant(identifier, seenIdToSlug)
  if (!variant) return { ok: false, code: 'VALIDATION_ERROR', message: error ?? 'Không hợp lệ.' }
  const qtyError = validateQuantity(quantity, variant.available_stock)
  if (qtyError) return { ok: false, code: 'VALIDATION_ERROR', message: qtyError }
  return writeCart(
    'cart_add_item',
    { p_variant_id: variant.variant_id, p_quantity: Math.floor(quantity) },
    cartTokenHash,
    rpc,
  )
}

export async function chatUpdateCartItem(
  cartTokenHash: string,
  identifier: string,
  quantity: number,
  seenIdToSlug?: Map<string, string>,
  rpc?: CartRpcClient,
): Promise<CartWriteResult> {
  const { variant, error } = await resolveCartVariant(identifier, seenIdToSlug)
  if (!variant) return { ok: false, code: 'VALIDATION_ERROR', message: error ?? 'Không hợp lệ.' }
  const qtyError = validateQuantity(quantity, variant.available_stock)
  if (qtyError) return { ok: false, code: 'VALIDATION_ERROR', message: qtyError }
  return writeCart(
    'cart_update_item',
    { p_item_id: variant.variant_id, p_quantity: Math.floor(quantity) },
    cartTokenHash,
    rpc,
  )
}

export async function chatRemoveFromCart(
  cartTokenHash: string,
  identifier: string,
  seenIdToSlug?: Map<string, string>,
  rpc?: CartRpcClient,
): Promise<CartWriteResult> {
  const { variant, error } = await resolveCartVariant(identifier, seenIdToSlug)
  if (!variant) return { ok: false, code: 'VALIDATION_ERROR', message: error ?? 'Không hợp lệ.' }
  return writeCart('cart_remove_item', { p_item_id: variant.variant_id }, cartTokenHash, rpc)
}

export interface CheckoutHandoff {
  checkout_url: string
  item_count: number
  subtotal: number
  note: string
}

/**
 * Checkout handoff (blueprint: checkout renders the cart for the host to
 * complete). Requires explicit customer confirmation; the model never places
 * the order and never sees payment.
 */
export async function chatCheckoutHandoff(
  cartTokenHash: string,
  confirmed: boolean,
  rpc?: CartRpcClient,
): Promise<{ handoff: CheckoutHandoff | null; error?: string }> {
  if (!confirmed) {
    return { handoff: null, error: 'Chốt đơn cần khách xác nhận rõ ("đồng ý thanh toán"). Tóm tắt giỏ và hỏi xác nhận trước.' }
  }
  const cart = await getChatCart(cartTokenHash, rpc)
  if (cart.item_count === 0) {
    return { handoff: null, error: 'Giỏ hàng đang trống — thêm món trước khi thanh toán.' }
  }
  return {
    handoff: {
      checkout_url: '/checkout',
      item_count: cart.item_count,
      subtotal: cart.subtotal,
      note: 'Mở trang thanh toán của website để điền thông tin và trả tiền — trợ lý không đặt hàng hộ.',
    },
  }
}
