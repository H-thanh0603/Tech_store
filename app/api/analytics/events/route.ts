import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import {
  ANALYTICS_EVENT_NAMES,
  sanitizeAnalyticsPayload,
  type AnalyticsPayload,
} from '@/lib/analytics'

const valueSchema = z.union([z.string().max(160), z.number().finite(), z.boolean(), z.null()])
const eventSchema = z.object({
  event: z.enum(ANALYTICS_EVENT_NAMES),
  payload: z.record(z.string().max(40), valueSchema).refine((value) => Object.keys(value).length <= 12),
  sessionId: z.uuid(),
  ts: z.number().int().positive(),
})
const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(20) })

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 32_000) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  let input: unknown
  try {
    const body = await request.text()
    if (body.length > 32_000) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }
    input = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = batchSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_batch' }, { status: 400 })
  }

  const now = Date.now()
  const rows = parsed.data.events.map((item) => {
    const payload = sanitizeAnalyticsPayload(item.payload as AnalyticsPayload)
    if (Object.keys(payload).length !== Object.keys(item.payload).length) return null
    const occurredAt = Math.min(Math.max(item.ts, now - 86_400_000), now + 60_000)
    return {
      event_name: item.event,
      session_id: item.sessionId,
      payload,
      occurred_at: new Date(occurredAt).toISOString(),
    }
  })

  if (rows.some((row) => row === null)) {
    return NextResponse.json({ error: 'pii_key_rejected' }, { status: 400 })
  }
  const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null)

  const { error } = await getSupabaseAdminClient().from('analytics_events').insert(validRows)
  if (error) {
    console.warn('[analytics] batch insert failed', error.code)
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }

  return NextResponse.json({ accepted: validRows.length }, { status: 202 })
}
