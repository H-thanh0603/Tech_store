import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { suggestProducts } from '@/lib/catalog/queries'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { trustedClientIp } from '@/lib/net/ip'

export const dynamic = 'force-dynamic'

/**
 * Lightweight product suggestions for header search.
 * Returns real catalog rows only — never fabricated results.
 * Perf: suggestProducts() runs a LIMIT-6 query with no count (the old path
 * paid count:exact + 12 rows per keystroke).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80)

  if (q.length < 2) {
    return NextResponse.json({ query: q, products: [], empty: false })
  }

  // Throttle suggest: 30/min per IP to prevent flood (API-009).
  // Platform-trusted IP (was spoofable last-hop XFF).
  try {
    const headerList = await headers()
    const ip = trustedClientIp(headerList, request.headers.get('x-forwarded-for'))
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: 'suggest',
      p_identity: ip,
      p_limit: 30,
      p_window_minutes: 1,
    })
    if (limited === true) {
      return NextResponse.json({ query: q, products: [], empty: true }, { status: 429 })
    }
  } catch {
    // fail-open for availability (search must keep working); loud so an
    // outage that disables the throttle is visible.
    const { logger } = await import('@/lib/logger')
    logger.warn('suggest rate-limit fail-open')
  }

  try {
    const cards = await suggestProducts(q)
    const products = cards.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandName: p.brandName,
      minPrice: p.minPrice,
      imageUrl: p.imageUrl,
      inStock: p.inStock,
    }))
    return NextResponse.json({
      query: q,
      products,
      empty: products.length === 0,
    })
  } catch {
    return NextResponse.json(
      { query: q, products: [], empty: true, error: true },
      { status: 500 },
    )
  }
}
