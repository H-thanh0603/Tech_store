import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { isCronAuthorized } from '@/lib/cron'
import { processPendingNotifications } from '@/lib/commerce/notify'

interface RouteResult {
  route: string
  ok: boolean
  detail: unknown
}

/**
 * Cron self-check. Runs each scheduled cron task inline and reports
 * 200 only if every task reports ok. The monitor workflow hits this
 * endpoint so a missing CRON_SECRET, a broken Vercel Cron schedule,
 * or a failing RPC is surfaced as a CI failure instead of an
 * unaudited dashboard view.
 *
 * Inlining avoids the HTTP roundtrip and double-auth check; the
 * CRON_SECRET gate is preserved so the route is not callable from
 * anywhere except the monitor workflow and the Vercel Cron.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: RouteResult[] = []

  const reservation = await runWithTiming(
    'release-expired-reservations',
    async () => {
      const { data, error } = await getSupabaseAdminClient().rpc(
        'release_expired_reservations',
      )
      if (error) throw new Error(error.message)
      return data
    },
  )
  results.push(reservation)

  const notifications = await runWithTiming(
    'process-notifications',
    async () => {
      const result = await processPendingNotifications()
      if (result.failed > 0) {
        throw new Error(
          `notify worker reported ${result.failed} failed delivery(ies)`,
        )
      }
      return result
    },
  )
  results.push(notifications)

  // Abandoned-cart reminders are idempotent (deduped by carts.reminded_at),
  // so running every 5 min via the 2-cron health job is safe and keeps
  // Vercel Hobby within 2-cron limit (OPS-002). Previously this was a
  // separate 0 */2 cron that pushed us to 4 crons.
  const abandoned = await runWithTiming(
    'abandoned-carts',
    async () => {
      const { data, error } = await getSupabaseAdminClient().rpc(
        'queue_abandoned_cart_emails',
      )
      if (error) throw new Error(error.message)
      return data
    },
  )
  results.push(abandoned)

  const allOk = results.every((r) => r.ok)
  return NextResponse.json(
    { ok: allOk, checkedAt: new Date().toISOString(), results },
    {
      status: allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

async function runWithTiming(
  route: string,
  run: () => Promise<unknown>,
): Promise<RouteResult> {
  const start = Date.now()
  try {
    const detail = await run()
    return { route, ok: true, detail }
  } catch (err) {
    return {
      route,
      ok: false,
      detail: {
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      },
    }
  }
}
