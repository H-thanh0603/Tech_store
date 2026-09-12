import type { NextRequest } from 'next/server'

import { GET as productsGET } from '@/app/api/agents/products/route'

/**
 * Versioned alias: `GET /api/v1/agents/products`. Canonical implementation
 * lives at `/api/agents/products`; v1 re-exports it so external agent clients
 * can pin a versioned path. See docs/ARCHITECTURE.md.
 */
export function GET(request: NextRequest) {
  return productsGET(request)
}
