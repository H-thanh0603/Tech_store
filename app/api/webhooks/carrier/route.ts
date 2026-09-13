import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'

// Carrier tracking webhook stub (GHN/GHTK → TechStore).
// Hiện tại: verify chữ ký tối giản qua shared secret, log event, trả 200 để
// carrier không retry bão. Live processing (đổi ship_state, notify khách)
// làm khi shop có hợp đồng + mapping mã địa chỉ — xem lib/shipping/*.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const carrier = request.headers.get('x-carrier')?.toLowerCase() ?? 'unknown'
  const signature = request.headers.get('x-carrier-signature') ?? ''
  const expected = process.env.CARRIER_WEBHOOK_SECRET ?? ''

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_JSON' }, { status: 400 })
  }

  if (!expected || signature !== expected) {
    logger.warn('carrier webhook unauthorized', { requestId, carrier })
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  logger.info('carrier webhook received', { requestId, carrier, body })
  return NextResponse.json({ ok: true }, { headers: { 'x-request-id': requestId } })
}
