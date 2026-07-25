import { NextResponse } from 'next/server'

import { getProducts } from '@/lib/catalog/queries'

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
