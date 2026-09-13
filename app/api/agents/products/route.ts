import { NextResponse } from 'next/server'

import { getProducts } from '@/lib/catalog/queries'
import { CATALOG_SORTS, type CatalogSort } from '@/lib/catalog/types'
import { isAgentReadLimited, toAgentProductCard } from '@/lib/agents/public-api'

/**
 * Public read-only catalog search for external AI agents (agent layer, see
 * docs/AGENT_LAYER.md). Returns the same data the storefront renders — no
 * fabrication, no hidden stock counts. Rate-limited per IP; a valid
 * `Authorization: Bearer tsa_*` upgrades to a per-agent bucket (5x quota).
 * Fail-open on limiter outage.
 */

const MAX_PAGE = 10

function parseSort(value: string | null): CatalogSort | undefined {
  return value && (CATALOG_SORTS as readonly string[]).includes(value)
    ? (value as CatalogSort)
    : undefined
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export async function GET(request: Request) {
  if (await isAgentReadLimited(request, 'agents_catalog')) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429 },
    )
  }

  const params = new URL(request.url).searchParams
  const page = Math.min(Math.max(Math.trunc(parseNumber(params.get('page')) ?? 1), 1), MAX_PAGE)

  try {
    const result = await getProducts({
      query: params.get('q')?.slice(0, 160) ?? undefined,
      category: params.get('category') ?? undefined,
      brand: params.get('brand') ?? undefined,
      useCase: params.get('useCase') ?? undefined,
      minPrice: parseNumber(params.get('minPrice')),
      maxPrice: parseNumber(params.get('maxPrice')),
      inStock: params.get('inStock') === '1',
      sort: parseSort(params.get('sort')),
      page,
    })
    return NextResponse.json({
      products: result.products.map(toAgentProductCard),
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
      total: result.total,
    })
  } catch {
    return NextResponse.json(
      { code: 'CATALOG_ERROR', message: 'Không tải được danh mục lúc này.' },
      { status: 500 },
    )
  }
}
