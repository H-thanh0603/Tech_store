import { NextResponse } from 'next/server'

import { isCronAuthorized, reportCronError } from '@/lib/cron'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Daily log retention sweep. Guarded by CRON_SECRET; Vercel Cron calls this
// once a day (see vercel.json). Keeps admin_audit_logs (180d),
// analytics_events (90d), and request_rate_limits (2d) from filling the
// 500 MB free-tier database.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdminClient().rpc('purge_expired_logs')
  if (error) {
    reportCronError('purge-logs', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...(data as object) })
}
