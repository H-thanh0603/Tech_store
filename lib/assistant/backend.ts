/**
 * TechStore StorefrontBackend (port of `commerce-agents` StorefrontBackend).
 *
 * Each method calls the store's own systems server-side; the model only ever
 * sees the returned DTOs (fenced by the agent loop). Pilot scope: catalog
 * search + product details + order tracking (phone-verified, read-only) +
 * static policies. Cart writes are OFF (see config + docs/ASSISTANT.md).
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
  filters?: { category?: string; brand?: string; maxPrice?: number; inStock?: boolean },
): Promise<{ products: ReturnType<typeof toCardSummary>[]; total: number }> {
  const result = await getProducts({
    query: query.trim().slice(0, 120) || undefined,
    category: filters?.category,
    brand: filters?.brand,
    maxPrice: filters?.maxPrice,
    inStock: filters?.inStock ?? true,
    sort: 'relevance',
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

/**
 * Phone-verified, read-only order lookup. Mirrors the verification the
 * `order_track` RPC performs (code + phone must match) but mints no access
 * token and sets no cookie — chat only reports status.
 */
export async function trackOrder(
  orderCode: string,
  phone: string,
): Promise<OrderStatusSummary | null> {
  const code = orderCode.trim().toUpperCase().slice(0, 24)
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (code.length < 4 || digits.length < 8) return null

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
