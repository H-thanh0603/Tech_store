import type { NextRequest } from 'next/server'

import { GET as compareGET } from '@/app/api/agents/compare/route'

/**
 * Versioned alias: `GET /api/v1/agents/compare`. Canonical implementation
 * lives at `/api/agents/compare`; v1 re-exports it so external agent clients
 * can pin a versioned path. See docs/ARCHITECTURE.md.
 */
export function GET(request: NextRequest) {
  return compareGET(request)
}
