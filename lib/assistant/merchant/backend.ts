/**
 * TechStore MerchantBackend reads (port of `commerce-agents` MerchantBackend
 * read surface, pilot subset). Server-side only; results are fenced by the
 * agent loop. Every number comes from the admin kernel — never invented.
 */

import { listAdminInventory } from '@/lib/admin/catalog-queries'
import { listAdminOrders } from '@/lib/admin/queries/orders'
import { getDashboardStats } from '@/lib/admin/queries/dashboard'
import { getAdminProduct, listAdminProducts } from '@/lib/admin/queries/products'

import { merchantConfig } from './config'
import type { LiveItemState } from './guardrails'

export interface BusinessSnapshot {
  period: string
  revenue7d: number
  newOrders7d: number
  pendingOrders: number
  lowStockCount: number
  draftProducts: number
}

export async function businessSnapshot(): Promise<BusinessSnapshot> {
  const stats = await getDashboardStats()
  return {
    period: '7 ngày gần nhất',
    revenue7d: stats.revenue7d,
    newOrders7d: stats.newOrders7d,
    pendingOrders: stats.pendingOrders,
    lowStockCount: stats.lowStockCount,
    draftProducts: stats.draftProducts,
  }
}

export interface AlertItem {
  productId: string
  name: string
  sku: string
  available: number
  threshold: number
  status: 'low_stock' | 'out_of_stock'
}

export async function inventoryAlerts(limit = 10): Promise<AlertItem[]> {
  const [low, out] = await Promise.all([
    listAdminInventory({ stock: 'low', pageSize: limit, sort: 'available', dir: 'asc' }),
    listAdminInventory({ stock: 'out', pageSize: limit, sort: 'available', dir: 'asc' }),
  ])
  const merged = [...out.rows, ...low.rows]
    .filter((row, index, arr) => arr.findIndex((r) => r.variantId === row.variantId) === index)
    .slice(0, limit)
  return merged.map((row) => ({
    productId: row.productId,
    name: row.productName,
    sku: row.sku,
    available: row.available,
    threshold: row.threshold,
    status: row.stockStatus === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
  }))
}

export interface OrderIssue {
  orderCode: string
  orderStatus: string
  paymentStatus: string
  total: number
  createdAt: string
}

const OPEN_STATUSES = ['pending', 'awaiting_payment'] as const

export async function orderIssues(limit = 10): Promise<OrderIssue[]> {
  const lists = await Promise.all(
    OPEN_STATUSES.map((status) =>
      listAdminOrders({ status, pageSize: limit, sort: 'created_at', dir: 'asc' }),
    ),
  )
  const merged = lists
    .flatMap((r) => r.rows)
    .filter((row, index, arr) => arr.findIndex((r) => r.orderCode === row.orderCode) === index)
    .slice(0, limit)
  return merged.map((row) => ({
    orderCode: row.orderCode,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    total: row.total,
    createdAt: row.createdAt,
  }))
}

export interface ListingHit {
  product_id: string
  name: string
  slug: string
  isPublished: boolean
  isArchived: boolean
  minPrice: number | null
  totalAvailable: number | null
}

export async function searchListings(query: string, limit = 8): Promise<ListingHit[]> {
  const result = await listAdminProducts({ q: query.trim().slice(0, 120), pageSize: limit })
  return result.rows.map((row) => ({
    product_id: row.id,
    name: row.name,
    slug: row.slug,
    isPublished: row.isPublished,
    isArchived: row.isArchived,
    minPrice: row.minPrice ?? null,
    totalAvailable: row.totalAvailable ?? null,
  }))
}

export interface ListingDetail extends ListingHit {
  variants: { id: string; sku: string; price: number; available: number }[]
}

export async function getListing(productId: string): Promise<ListingDetail | null> {
  const detail = await getAdminProduct(productId.trim().slice(0, 80))
  if (!detail) return null
  const prices = detail.variants.map((v) => (v.salePrice ?? v.regularPrice))
  return {
    product_id: detail.id,
    name: detail.name,
    slug: detail.slug,
    isPublished: detail.isPublished,
    isArchived: detail.isArchived,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    totalAvailable: detail.variants.reduce((sum, v) => sum + Math.max(v.available, 0), 0),
    variants: detail.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: v.salePrice ?? v.regularPrice,
      available: Math.max(v.available, 0),
    })),
  }
}

/** Live price/stock snapshot for guardrails, keyed by product id. */
export async function liveStates(productIds: string[]): Promise<Map<string, LiveItemState>> {
  const map = new Map<string, LiveItemState>()
  const unique = [...new Set(productIds)].slice(0, merchantConfig.maxItemsPerChange + 5)
  const details = await Promise.all(unique.map((id) => getListing(id)))
  for (const d of details) {
    if (!d) continue
    map.set(d.product_id, {
      productId: d.product_id,
      name: d.name,
      minPrice: d.minPrice ?? 0,
      availableStock: d.totalAvailable ?? 0,
    })
  }
  return map
}
