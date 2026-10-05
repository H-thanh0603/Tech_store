/**
 * TechStore StorefrontBackend (port of `commerce-agents` StorefrontBackend).
 *
 * Each method calls the store's own systems server-side; the model only ever
 * sees the returned DTOs (fenced by the agent loop). Full scope: catalog
 * search + details + compare + plans + fulfillment + order tracking/history
 * (phone-verified, read-only) + static policies. Cart writes live in
 * `./cart.ts` under provenance + quantity gates (see config).
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getProductBySlug, getProducts } from '@/lib/catalog/queries'
import type { ProductCardData, ProductDetail } from '@/lib/catalog/types'

import { assistantConfig } from './config'
import { searchPolicies, type PolicyPassage } from './policies'

export interface OrderStatusSummary {
  orderCode: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  total: number
  itemCount: number
  createdAt: string
}

function toCardSummary(p: ProductCardData) {  return {
    product_id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brandName,
    category: p.categorySlug,
    price: p.minPrice,
    has_discount: p.hasDiscount,
    in_stock: p.inStock,
    available_stock: p.availableStock,
    image: p.imageUrl,
    url: `/products/${p.slug}`,
  }
}

export type CardSummary = ReturnType<typeof toCardSummary>

export async function searchProducts(
  query: string,
  filters?: {
    category?: string
    brand?: string
    maxPrice?: number
    inStock?: boolean
    sort?: 'relevance' | 'price-asc' | 'price-desc' | 'newest'
  },
): Promise<{ products: ReturnType<typeof toCardSummary>[]; total: number }> {
  const result = await getProducts({
    query: query.trim().slice(0, 120) || undefined,
    category: filters?.category,
    brand: filters?.brand,
    maxPrice: filters?.maxPrice,
    inStock: filters?.inStock ?? true,
    sort: filters?.sort ?? 'relevance',
    page: 1,
  })
  const products = result.products.slice(0, assistantConfig.searchLimit).map(toCardSummary)
  return { products, total: result.total }
}

function toDetailSummary(d: ProductDetail) {
  return {
    product_id: d.id,
    slug: d.slug,
    name: d.name,
    brand: d.brandName,
    category: d.categoryName,
    description: d.description?.slice(0, 800) ?? null,
    min_price: d.minPrice,
    has_discount: d.hasDiscount,
    in_stock: d.inStock,
    available_stock: d.availableStock,
    images: d.images.slice(0, 4).map((img) => img.url),
    variants: d.variants.map((v) => ({
      product_id: v.id,
      sku: v.sku,
      attributes: v.attributes,
      price: v.price,
      sale_price: v.salePrice,
      in_stock: v.inStock,
      available_stock: v.availableStock,
    })),
    specs: d.specs.slice(0, 24).map((s) => ({ group: s.group, label: s.label, value: s.value })),
    use_cases: d.useCases,
    url: `/products/${d.slug}`,
  }
}

export type ProductDetailSummary = ReturnType<typeof toDetailSummary>

/**
 * Resolve a slug or a product/variant id seen in this turn. Variant ids
 * resolve to their parent product (the cart takes variants, but the pilot
 * has no cart — the detail view is what the customer needs).
 */
export async function getProductDetails(
  identifier: string,
  seenIdToSlug?: Map<string, string>,
): Promise<ProductDetailSummary | null> {
  const id = identifier.trim().slice(0, 160)
  const slug = seenIdToSlug?.get(id) ?? id
  const detail = await getProductBySlug(slug)
  if (!detail) return null
  return toDetailSummary(detail)
}

export function policyResults(query: string): PolicyPassage[] {
  return searchPolicies(query, 3)
}

export interface FulfillmentOptions {
  delivery: {
    rate_name: string
    base_rate: number
    per_item_rate: number
    free_threshold: number
    quote: { fee: number; is_free: boolean } | null
  } | null
  pickup_stores: Array<{
    id: string
    name: string
    phone: string | null
    province: string
    district: string
    address: string
    opening_hours: string
  }>
  carriers: string[]
  note: string
}

/**
 * Fulfillment options flow: live delivery rate + pickup stores + configured
 * carriers. An exact per-order fee still comes from checkout (cart-aware);
 * this tool answers "ship bao nhiêu / lấy ở đâu" from live systems.
 */
export async function fulfillmentOptions(input?: {
  subtotal?: number
  itemCount?: number
}): Promise<FulfillmentOptions> {
  const db = getSupabaseAdminClient()
  const [rateRes, storeRes] = await Promise.all([
    db
      .from('shipping_rates')
      .select('name, base_rate, per_item_rate, free_threshold')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('stores')
      .select('id, name, phone, province, district, street_address, opening_hours')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(20),
  ])
  const rate = (rateRes?.data ?? null) as {
    name?: unknown
    base_rate?: unknown
    per_item_rate?: unknown
    free_threshold?: unknown
  } | null
  const subtotal = typeof input?.subtotal === 'number' && Number.isFinite(input.subtotal) ? Math.max(0, Math.floor(input.subtotal)) : null
  const itemCount = typeof input?.itemCount === 'number' && Number.isFinite(input.itemCount) ? Math.max(0, Math.floor(input.itemCount)) : null
  const baseRate = Number(rate?.base_rate ?? 0)
  const perItemRate = Number(rate?.per_item_rate ?? 0)
  const freeThreshold = Number(rate?.free_threshold ?? 0)
  return {
    delivery:
      rate == null
        ? null
        : {
            rate_name: String(rate.name ?? 'Tiêu chuẩn'),
            base_rate: baseRate,
            per_item_rate: perItemRate,
            free_threshold: freeThreshold,
            quote:
              subtotal != null && itemCount != null && itemCount > 0
                ? {
                    fee: freeThreshold > 0 && subtotal >= freeThreshold ? 0 : baseRate + perItemRate * Math.max(itemCount - 1, 0),
                    is_free: freeThreshold > 0 && subtotal >= freeThreshold,
                  }
                : null,
          },
    pickup_stores: ((storeRes?.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id ?? ''),
      name: String(s.name ?? ''),
      phone: s.phone == null ? null : String(s.phone),
      province: String(s.province ?? ''),
      district: String(s.district ?? ''),
      address: String(s.street_address ?? ''),
      opening_hours: String(s.opening_hours ?? ''),
    })),
    carriers: ['internal', 'ghn', 'ghtk'],
    note: 'Phí ship chính xác theo giỏ hiện ở bước thanh toán; nhận tại cửa hàng luôn miễn phí.',
  }
}

/**
 * Phone-verified, read-only order lookup. Mirrors the verification the
 * `order_track` RPC performs (code + phone must match) but mints no access
 * token and sets no cookie — chat only reports status.
 *
 * H3: full 10-digit normalized phone required. Short suffixes (7–9 digits)
 * are rejected — they turn the endpoint into a phone-oracle where one guess
 * matches many strangers' orders.
 */
export async function trackOrder(
  orderCode: string,
  phone: string,
): Promise<OrderStatusSummary | null> {
  const code = orderCode.trim().toUpperCase().slice(0, 24)
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (code.length < 4 || digits.length !== 10) return null

  const db = getSupabaseAdminClient()
  const { data: order, error } = await db
    .from('orders')
    .select('id, order_code, customer_phone, order_status, payment_status, payment_method, total, created_at')
    .eq('order_code', code)
    .maybeSingle()
  if (error || !order) return null

  const storedDigits = String(order.customer_phone ?? '').replace(/\D/g, '').slice(-10)
  if (storedDigits !== digits) return null

  const { data: items } = await db
    .from('order_items')
    .select('quantity')
    .eq('order_id', order.id)
  const itemCount = (items ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)

  return {
    orderCode: String(order.order_code),
    orderStatus: String(order.order_status),
    paymentStatus: String(order.payment_status),
    paymentMethod: String(order.payment_method ?? ''),
    total: Number(order.total ?? 0),
    itemCount,
    createdAt: String(order.created_at ?? ''),
  }
}

export interface OrderHistoryItem {
  orderCode: string
  orderStatus: string
  paymentStatus: string
  total: number
  itemCount: number
  createdAt: string
}

/**
 * Phone-scoped recent orders (guest-safe history: no account, no token).
 * Returns null for an invalid phone, [] when the phone has no orders.
 * Item counts only — no payment details, no addresses.
 *
 * H3: full 10-digit phone required and matched exactly on the normalized
 * suffix (no short-suffix ilike enumeration). Disable entirely with
 * ASSISTANT_NO_ORDER_HISTORY=1 (assistantConfig.enableOrderHistory).
 */
export async function orderHistory(phone: string): Promise<OrderHistoryItem[] | null> {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return null

  const db = getSupabaseAdminClient()
  // Full-suffix match only: the leading % is unavoidable while numbers are
  // stored formatted, but 10 digits keep the anonymity set at one subscriber
  // instead of a whole prefix block. Never shorten this to 7–9 digits.
  const { data: orders, error } = await db
    .from('orders')
    .select('id, order_code, customer_phone, order_status, payment_status, total, created_at')
    .ilike('customer_phone', `%${digits}`)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !orders) return []
  const rows = (orders as Array<Record<string, unknown>>).filter((o) =>
    String(o.customer_phone ?? '').replace(/\D/g, '').slice(-10) === digits,
  )
  const history: OrderHistoryItem[] = []
  for (const order of rows) {
    const { data: items } = await db.from('order_items').select('quantity').eq('order_id', order.id)
    const itemCount = ((items ?? []) as Array<{ quantity?: unknown }>).reduce(
      (sum, row) => sum + Number(row.quantity ?? 0),
      0,
    )
    history.push({
      orderCode: String(order.order_code),
      orderStatus: String(order.order_status),
      paymentStatus: String(order.payment_status),
      total: Number(order.total ?? 0),
      itemCount,
      createdAt: String(order.created_at ?? ''),
    })
  }
  return history
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Provenance gate (port of commerce-agents gates.py): opaque internal ids
 * are only usable when a tool returned them in this conversation. Slugs are
 * public and always resolvable; unknown slugs are reported, never guessed.
 * Returns the slug to resolve, or null when the identifier is rejected.
 */
export function resolveSeenOrSlug(
  identifier: string,
  seenIdToSlug?: Map<string, string>,
): string | null {
  const id = identifier.trim().slice(0, 160)
  if (!id) return null
  const seen = seenIdToSlug?.get(id)
  if (seen) return seen
  if (UUID_LIKE.test(id)) return null
  return id.toLowerCase()
}

export interface CompareRow {
  product_id: string
  slug: string
  name: string
  brand: string
  min_price: number
  has_discount: boolean
  in_stock: boolean
  available_stock: number
  variant_count: number
  key_specs: Array<{ label: string; value: string }>
  url: string
}

export interface CompareResult {
  rows: CompareRow[]
  unknownIdentifiers: string[]
  summary: { cheapest: { slug: string; min_price: number } | null; inStock: string[] }
}

/** Side-by-side comparison of 2–4 products for the compare flow. */
export async function compareProducts(
  identifiers: string[],
  seenIdToSlug?: Map<string, string>,
): Promise<CompareResult> {
  const unique = [...new Set(identifiers.map((s) => String(s ?? '').trim()).filter(Boolean))].slice(0, 4)
  const rows: CompareRow[] = []
  const unknownIdentifiers: string[] = []
  for (const raw of unique) {
    const slug = resolveSeenOrSlug(raw, seenIdToSlug)
    const detail = slug ? await getProductBySlug(slug) : null
    if (!detail) {
      unknownIdentifiers.push(raw)
      continue
    }
    rows.push({
      product_id: detail.id,
      slug: detail.slug,
      name: detail.name,
      brand: detail.brandName ?? '',
      min_price: detail.minPrice,
      has_discount: detail.hasDiscount,
      in_stock: detail.inStock,
      available_stock: detail.availableStock,
      variant_count: detail.variants.length,
      key_specs: detail.specs.slice(0, 6).map((s) => ({ label: s.label, value: s.value })),
      url: `/products/${detail.slug}`,
    })
  }
  const byPrice = [...rows].sort((a, b) => a.min_price - b.min_price)
  return {
    rows,
    unknownIdentifiers,
    summary: {
      cheapest: byPrice.length > 0 ? { slug: byPrice[0].slug, min_price: byPrice[0].min_price } : null,
      inStock: rows.filter((r) => r.in_stock).map((r) => r.slug),
    },
  }
}

export interface PlanLineInput {
  identifier: string
  quantity: number
}

export interface PlanDraft {
  title: string
  lines: Array<{
    product_id: string
    slug: string
    name: string
    unit_price: number
    quantity: number
    line_total: number
    url: string
  }>
  total: number
  budget: number | null
  overBudget: boolean
  rejected: Array<{ identifier: string; reason: string }>
}

export const MAX_PLAN_LINES = 6
export const MAX_PLAN_QTY = 10

/**
 * Shopping plan flow: validate a shortlist (provenance + stock + quantity
 * caps) and price it against an optional budget. The plan hands off to cart
 * tools — it never reserves stock.
 */
export async function buildShoppingPlan(
  input: { title?: string; budget?: number; lines: PlanLineInput[] },
  seenIdToSlug?: Map<string, string>,
): Promise<PlanDraft> {
  const lines: PlanDraft['lines'] = []
  const rejected: PlanDraft['rejected'] = []
  let total = 0
  for (const line of (input.lines ?? []).slice(0, MAX_PLAN_LINES)) {
    const qty = Math.floor(Number(line.quantity))
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_PLAN_QTY) {
      rejected.push({ identifier: String(line.identifier ?? ''), reason: `Số lượng phải 1–${MAX_PLAN_QTY}.` })
      continue
    }
    const slug = resolveSeenOrSlug(String(line.identifier ?? ''), seenIdToSlug)
    if (!slug) {
      rejected.push({ identifier: String(line.identifier ?? ''), reason: 'Chỉ dùng id do tool trả về trong cuộc trò chuyện.' })
      continue
    }
    const detail = await getProductBySlug(slug)
    if (!detail) {
      rejected.push({ identifier: String(line.identifier ?? ''), reason: 'Không tìm thấy sản phẩm.' })
      continue
    }
    if (!detail.inStock) {
      rejected.push({ identifier: detail.slug, reason: 'Sản phẩm đang hết hàng.' })
      continue
    }
    const lineTotal = detail.minPrice * qty
    total += lineTotal
    lines.push({
      product_id: detail.id,
      slug: detail.slug,
      name: detail.name,
      unit_price: detail.minPrice,
      quantity: qty,
      line_total: lineTotal,
      url: `/products/${detail.slug}`,
    })
  }
  const budget = typeof input.budget === 'number' && Number.isFinite(input.budget) && input.budget > 0
    ? Math.floor(input.budget)
    : null
  return {
    title: (input.title ?? 'Kế hoạch mua sắm').slice(0, 120),
    lines,
    total,
    budget,
    overBudget: budget != null && total > budget,
    rejected,
  }
}
