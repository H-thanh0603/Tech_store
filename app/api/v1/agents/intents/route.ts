import type { NextRequest } from 'next/server'

import { POST as intentsPOST } from '@/app/api/agents/intents/route'

/**
 * Versioned alias: `POST /api/v1/agents/intents`. Canonical implementation
 * lives at `/api/agents/intents`; v1 re-exports it so external agent clients
 * can pin a versioned path. See docs/ARCHITECTURE.md.
 */
export function POST(request: NextRequest) {
  return intentsPOST(request)
}
