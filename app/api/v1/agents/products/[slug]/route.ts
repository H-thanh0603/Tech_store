import type { NextRequest } from 'next/server'

import { GET as productDetailGET } from '@/app/api/agents/products/[slug]/route'

/**
 * Versioned alias: `GET /api/v1/agents/products/{slug}`. Canonical
 * implementation lives at `/api/agents/products/[slug]`.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  return productDetailGET(request, context)
}
