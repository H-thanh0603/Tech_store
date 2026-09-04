import { timingSafeEqual } from 'node:crypto'

import * as Sentry from '@sentry/nextjs'

export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const received = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Cron routes swallow failures into JSON 500s, which Sentry's route-handler
// instrumentation never sees (OPS-007/008). Report explicitly so a failing
// sweeper pages ops instead of rotting silently. No-op when Sentry has no DSN.
export function reportCronError(route: string, err: unknown): void {
  try {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { cron_route: route },
    })
  } catch {
    // reporting must never break the cron response
  }
}
