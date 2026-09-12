import { NextResponse } from 'next/server'

import { isCronAuthorized, reportCronError } from '@/lib/cron'

import { composeDigest } from '@/lib/assistant/merchant/digest'

/**
 * Merchant digest composer. Guarded by CRON_SECRET. Called inline from
 * /api/cron/health once a day (Vercel Hobby 2-cron limit) — also callable
 * directly for manual refresh.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await composeDigest()
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    reportCronError('merchant-digest', error)
    return NextResponse.json({ ok: false, error: 'digest failed' }, { status: 500 })
  }
}
