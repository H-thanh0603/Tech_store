import { logger } from '@/lib/logger'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// CSP violation collector for proxy.ts's report-uri directive. Violations
// are logged with structure so Sentry (wired via logger) surfaces real
// injection attempts; the response is always 204 so the browser is never
// blocked waiting. Reports are unauthenticated by spec — they must be.
export async function POST(request: Request) {
  // Body cap 8KB (API-013) + rate-limit 20/min per IP to prevent log flood
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 8192) {
    return new Response(null, { status: 204 })
  }
  try {
    const ip =
      request.headers.get('x-real-ip')?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
      'unknown'
    try {
      const { data: limited } = await getSupabaseServerClient().rpc('check_rate_limit', {
        p_action: 'suggest',
        p_identity: `csp:${ip}`,
        p_limit: 20,
        p_window_minutes: 1,
      })
      if (limited === true) return new Response(null, { status: 204 })
    } catch {
      // fail-open
    }

    const text = await request.text()
    if (text.length > 8192) return new Response(null, { status: 204 })
    const report = JSON.parse(text) as { 'csp-report'?: Record<string, unknown> }
    const violation = report['csp-report']
    if (violation) {
      logger.warn('csp_violation', {
        documentUri: violation['document-uri'],
        violatedDirective: violation['violated-directive'],
        blockedUri: violation['blocked-uri'],
        sourceFile: violation['source-file'],
        statusCode: violation['status-code'],
      })
    }
  } catch {
    // Malformed report payloads are dropped silently.
  }
  return new Response(null, { status: 204 })
}
