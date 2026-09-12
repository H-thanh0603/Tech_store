import { GET as manifestGET } from '@/app/api/agents/manifest/route'

/**
 * Versioned alias: `GET /api/v1/agents/manifest`. Canonical implementation
 * lives at `/api/agents/manifest`.
 */
export function GET() {
  return manifestGET()
}
