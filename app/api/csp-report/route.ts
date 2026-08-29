import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// CSP violation collector for proxy.ts's report-uri directive. Violations
// are logged with structure so Sentry (wired via logger) surfaces real
// injection attempts; the response is always 204 so the browser is never
// blocked waiting. Reports are unauthenticated by spec — they must be.
export async function POST(request: Request) {
  try {
    const report = await request.json()
    const violation = (report as { 'csp-report'?: Record<string, unknown> })[
      'csp-report'
    ]
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
