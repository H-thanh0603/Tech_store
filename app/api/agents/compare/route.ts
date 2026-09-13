import { NextResponse } from 'next/server'

import { getProductBySlug } from '@/lib/catalog/queries'
import {
  isAgentReadLimited,
  toAgentProductDetail,
} from '@/lib/agents/public-api'

/**
 * Public read-only product comparison for external AI agents (agent layer,
 * see docs/AGENT_LAYER.md). `GET /api/agents/compare?slugs=a,b,c` with 2–4
 * slugs returns the same detail envelopes as getProduct plus a summary
 * (cheapest, in-stock) so the agent compares without re-deriving prices.
 * Unknown slugs are reported explicitly — never silently dropped, never
 * fabricated.
 */

const MIN_SLUGS = 2
const MAX_SLUGS = 4

export async function GET(request: Request) {
  if (await isAgentReadLimited(request, 'agents_catalog')) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429 },
    )
  }

  const raw = new URL(request.url).searchParams.get('slugs') ?? ''
  const slugs = [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))]
  if (slugs.length < MIN_SLUGS || slugs.length > MAX_SLUGS) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: `So sánh cần ${MIN_SLUGS}–${MAX_SLUGS} slug, cách nhau bằng dấu phẩy.` },
      { status: 400 },
    )
  }

  try {
    const found = (
      await Promise.all(slugs.map(async (slug) => ({ slug, product: await getProductBySlug(slug) })))
    ).filter((r): r is { slug: string; product: NonNullable<typeof r.product> } => r.product !== null)

    if (found.length === 0) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm nào trong danh sách.' },
        { status: 404 },
      )
    }

    const products = found.map((r) => toAgentProductDetail(r.product))
    const byPrice = [...products].sort((a, b) => a.minPrice - b.minPrice)
    return NextResponse.json({
      products,
      unknownSlugs: slugs.filter((s) => !found.some((r) => r.slug === s)),
      summary: {
        cheapest: { slug: byPrice[0].slug, minPrice: byPrice[0].minPrice },
        priciest: {
          slug: byPrice[byPrice.length - 1].slug,
          minPrice: byPrice[byPrice.length - 1].minPrice,
        },
        inStock: products.filter((p) => p.inStock).map((p) => p.slug),
      },
    })
  } catch {
    return NextResponse.json(
      { code: 'CATALOG_ERROR', message: 'Không tải được sản phẩm lúc này.' },
      { status: 500 },
    )
  }
}
