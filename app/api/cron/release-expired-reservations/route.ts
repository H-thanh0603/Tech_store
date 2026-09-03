import { NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/cron'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Cron sweep: expire overdue awaiting_payment orders and release their stock
// reservations. Complements the lazy expiry in order_track. Guarded by
// CRON_SECRET; Vercel Cron (vercel.json) calls this periodically.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    'release_expired_reservations',
  )
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...(data as object) })
}
