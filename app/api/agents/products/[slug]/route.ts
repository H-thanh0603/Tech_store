import { NextResponse } from 'next/server'

import { getProductBySlug } from '@/lib/catalog/queries'
import { agentClientIp, isAgentRateLimited, toAgentProductDetail } from '@/lib/agents/public-api'

/**
 * Public read-only product detail for external AI agents (agent layer, see
 * docs/AGENT_LAYER.md). One product per request by slug.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (await isAgentRateLimited('agents_catalog', agentClientIp(request.headers))) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429 },
    )
  }

  const { slug } = await params
  try {
    const product = await getProductBySlug(slug)
    if (!product) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ product: toAgentProductDetail(product) })
  } catch {
    return NextResponse.json(
      { code: 'CATALOG_ERROR', message: 'Không tải được sản phẩm lúc này.' },
      { status: 500 },
    )
  }
}
