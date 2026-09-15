import { NextResponse } from 'next/server'

import { isCronAuthorized, reportCronError } from '@/lib/cron'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Daily log retention sweep. Guarded by CRON_SECRET; Vercel Cron calls this
// once a day (see vercel.json). Keeps admin_audit_logs (180d),
// analytics_events (90d), and request_rate_limits (2d) from filling the
// 500 MB free-tier database. Also drains checkout hot tables (C3
// purge_checkout_hot_tables: week-old expired reservations + stale buckets)
// — best-effort so a missing C3 migration never fails this cron.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdminClient().rpc('purge_expired_logs')
  if (error) {
    reportCronError('purge-logs', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  let hotTables: unknown = null
  try {
    const { data: hot } = await getSupabaseAdminClient().rpc('purge_checkout_hot_tables')
    hotTables = hot
  } catch {
    // C3 migration not yet applied (staging) — sweep still succeeds.
  }
  return NextResponse.json({ ok: true, ...(data as object), hotTables })
}
