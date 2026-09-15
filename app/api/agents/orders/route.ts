import { NextResponse } from 'next/server'
import { z } from 'zod'

import { trackOrder } from '@/lib/assistant/backend'
import { isAgentReadLimited } from '@/lib/agents/public-api'

/**
 * Public read-only order status for external AI agents (agent layer, see
 * docs/AGENT_LAYER.md). Same trust boundary as the storefront /track-order
 * page and the shopping assistant: code + phone must both match, no tokens,
 * no PII beyond status fields. Ordering/payment remain human-only.
 *
 * H3: prefer POST with a JSON body — GET puts code+phone in URL logs,
 * caches and referrers. GET stays for backwards compat but responses carry
 * `Cache-Control: no-store` either way.
 */

const bodySchema = z.object({
  order_code: z.string().trim().min(4).max(24),
  phone: z.string().trim().min(8).max(20),
})

const NO_STORE = { 'Cache-Control': 'no-store' }

async function lookup(orderCode: string, phone: string) {
  try {
    const order = await trackOrder(orderCode, phone)
    if (!order) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng khớp.' },
        { status: 404, headers: NO_STORE },
      )
    }
    return NextResponse.json({ order }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { code: 'ORDER_ERROR', message: 'Không tra cứu được đơn hàng lúc này.' },
      { status: 500, headers: NO_STORE },
    )
  }
}
export async function GET(request: Request) {
  if (await isAgentReadLimited(request, 'agents_orders')) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429, headers: NO_STORE },
    )
  }

  const params = new URL(request.url).searchParams
  const orderCode = params.get('order_code')?.trim()
  const phone = params.get('phone')?.trim()
  if (!orderCode || !phone) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Cần cả mã đơn hàng và số điện thoại đặt hàng.' },
      { status: 400, headers: NO_STORE },
    )
  }

  return lookup(orderCode, phone)
}

export async function POST(request: Request) {
  if (await isAgentReadLimited(request, 'agents_orders')) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429, headers: NO_STORE },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Body phải là JSON {order_code, phone}.' },
      { status: 400, headers: NO_STORE },
    )
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Cần cả mã đơn hàng và số điện thoại đặt hàng.' },
      { status: 400, headers: NO_STORE },
    )
  }
  return lookup(parsed.data.order_code, parsed.data.phone)
}
