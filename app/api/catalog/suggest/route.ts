import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { getProducts } from '@/lib/catalog/queries'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Lightweight product suggestions for header search.
 * Returns real catalog rows only — never fabricated results.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80)

  if (q.length < 2) {
    return NextResponse.json({ query: q, products: [], empty: false })
  }

  // Throttle suggest: 30/min per IP to prevent count:exact flood (API-009)
  try {
    const headerList = await headers()
    const ip =
      headerList.get('x-real-ip')?.trim() ||
      headerList.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
      'unknown'
    const { data: limited } = await getSupabaseServerClient().rpc('check_rate_limit', {
      p_action: 'suggest',
      p_identity: ip,
      p_limit: 30,
      p_window_minutes: 1,
    })
    if (limited === true) {
      return NextResponse.json({ query: q, products: [], empty: true }, { status: 429 })
    }
  } catch {
    // fail-open
  }

  try {
    const result = await getProducts({ query: q, page: 1, sort: 'relevance' })
    const products = result.products.slice(0, 6).map((p) => ({
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
      total: result.total,
    })
  } catch {
    return NextResponse.json(
      { query: q, products: [], empty: true, error: true },
      { status: 500 },
    )
  }
}
