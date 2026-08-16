import { NextResponse } from 'next/server'

import { processPendingNotifications } from '@/lib/commerce/notify'

// Cron drain for notification_outbox. Guarded by CRON_SECRET; Vercel Cron
// (vercel.json) or any scheduler calls this periodically.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const received = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!expected || received !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await processPendingNotifications()
  return NextResponse.json({ ok: true, ...result })
}
