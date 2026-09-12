import type { NextRequest } from 'next/server'

import { GET as policiesGET } from '@/app/api/agents/policies/route'

/**
 * Versioned alias: `GET /api/v1/agents/policies`. Canonical implementation
 * lives at `/api/agents/policies`.
 */
export function GET(request: NextRequest) {
  return policiesGET(request)
}
