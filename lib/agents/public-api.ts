/**
 * Shared plumbing for the public agent API — the "agent layer" alongside the
 * human UI (docs/AGENT_LAYER.md). Read-only by design: ordering and payment
 * stay human-controlled on the website.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { ProductCardData, ProductDetail } from '@/lib/catalog/types'
import { getSiteUrl } from '@/lib/site'

import { verifyAgentReadToken } from './tokens'

export const AGENT_CATALOG_LIMIT = 60
export const AGENT_ORDERS_LIMIT = 20
// Authenticated agents (valid tsa_ token) get 5x quota on reads — they are
// attributable and revocable, unlike anonymous IPs behind NAT.
export const AGENT_AUTH_MULTIPLIER = 5
export const AGENT_CATALOG_ACTION = 'agents_catalog'
export const AGENT_ORDERS_ACTION = 'agents_orders'
const WINDOW_MINUTES = 15

// Same IP resolution as the assistant endpoints: request.headers (not
// next/headers) so the routes stay unit-testable.
export function agentClientIp(headerList: Pick<Headers, 'get'>, fallback?: string | null): string {
  return (
    headerList.get('x-real-ip')?.trim() ||
    headerList.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    fallback?.split(',').at(-1)?.trim() ||
    'unknown'
  )
}

/** True when the caller exceeded the bucket — respond 429. Fail-open on limiter outage. */
export async function isAgentRateLimited(
  action: 'agents_catalog' | 'agents_orders',
  identity: string,
): Promise<boolean> {
  try {
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: action,
      p_identity: identity,
      p_limit: action === 'agents_catalog' ? AGENT_CATALOG_LIMIT : AGENT_ORDERS_LIMIT,
      p_window_minutes: WINDOW_MINUTES,
    })
    return limited === true
  } catch {
    return false
  }
}

/**
 * Per-agent read gate: a valid `Authorization: Bearer tsa_*` upgrades the
 * caller to a per-agent bucket (5x quota, attributable); anonymous callers
 * stay on the IP bucket. Returns true when limited — respond 429.
 */
export async function isAgentReadLimited(request: Request, action: 'agents_catalog' | 'agents_orders'): Promise<boolean> {
  const token = await verifyAgentReadToken(request.headers.get('authorization'))
  const base = action === 'agents_catalog' ? AGENT_CATALOG_LIMIT : AGENT_ORDERS_LIMIT
  // Same action name, different identity ⇒ separate bucket (the DB allowlist
  // only permits known actions, so no new action string may be introduced
  // without a migration).
  const identity = token ? `agent:${token.id}` : agentClientIp(request.headers)
  const limit = token ? base * AGENT_AUTH_MULTIPLIER : base
  try {
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: action,
      p_identity: identity,
      p_limit: limit,
      p_window_minutes: WINDOW_MINUTES,
    })
    return limited === true
  } catch {
    return false
  }
}

function absoluteUrl(path: string | null | undefined, base: string): string | null {
  if (!path) return null
  try {
    return new URL(path, base).toString()
  } catch {
    return null
  }
}

// Exact stock counts stay internal — the human UI only reveals "low stock"
// thresholds, and agents get the same: inStock/lowStock booleans answer "can I
// buy it now" without leaking inventory levels to bulk scrapers.
export function toAgentProductCard(p: ProductCardData) {
  const base = getSiteUrl()
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brandName,
    category: p.categorySlug,
    url: `${base}/products/${p.slug}`,
    imageUrl: absoluteUrl(p.imageUrl, base),
    minPrice: p.minPrice,
    hasDiscount: p.hasDiscount,
    inStock: p.inStock,
    lowStock: p.inStock && p.availableStock > 0 && p.availableStock <= 5,
  }
}

export function toAgentProductDetail(p: ProductDetail) {
  const base = getSiteUrl()
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brandName,
    category: p.categorySlug,
    categoryName: p.categoryName,
    description: p.description,
    url: `${base}/products/${p.slug}`,
    minPrice: p.minPrice,
    hasDiscount: p.hasDiscount,
    inStock: p.inStock,
    images: p.images
      .map((i) => ({ url: absoluteUrl(i.url, base), alt: i.alt }))
      .filter((i): i is { url: string; alt: string | null } => i.url !== null),
    // Variant ids stay internal: agents reference products by slug; a variant
    // is identified by its SKU + attributes when the human goes to buy.
    variants: p.variants.map((v) => ({
      sku: v.sku,
      attributes: v.attributes,
      regularPrice: v.regularPrice,
      salePrice: v.salePrice,
      price: v.price,
      hasDiscount: v.hasDiscount,
      inStock: v.inStock,
    })),
    specs: p.specs,
    useCases: p.useCases,
  }
}
