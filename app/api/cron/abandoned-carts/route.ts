import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Cron sweep: queue abandoned-cart reminder emails (one per cart, deduped by
// carts.reminded_at) into notification_outbox. Guarded by CRON_SECRET; Vercel
// Cron (vercel.json) calls this every two hours.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const received = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!expected || received !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    'queue_abandoned_cart_emails',
  )
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...(data as object) })
}
