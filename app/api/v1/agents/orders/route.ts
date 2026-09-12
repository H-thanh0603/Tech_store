import type { NextRequest } from 'next/server'

import { GET as ordersGET } from '@/app/api/agents/orders/route'

/**
 * Versioned alias: `GET /api/v1/agents/orders`. Canonical implementation
 * lives at `/api/agents/orders`.
 */
export function GET(request: NextRequest) {
  return ordersGET(request)
}
