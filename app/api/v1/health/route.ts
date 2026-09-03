import type { NextRequest } from 'next/server'

import { GET as healthGET } from '@/app/api/health/route'

/**
 * Versioned alias: `GET /api/v1/health`.
 * Canonical implementation lives at `/api/health`; v1 re-exports it so
 * external clients can pin a versioned path. See docs/ARCHITECTURE.md.
 */
export function GET(request: NextRequest) {
  return healthGET(request)
}
