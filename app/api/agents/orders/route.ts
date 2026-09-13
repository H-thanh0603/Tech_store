import { NextResponse } from 'next/server'

import { trackOrder } from '@/lib/assistant/backend'
import { isAgentReadLimited } from '@/lib/agents/public-api'

/**
 * Public read-only order status for external AI agents (agent layer, see
 * docs/AGENT_LAYER.md). Same trust boundary as the storefront /track-order
 * page and the shopping assistant: code + phone must both match, no tokens,
 * no PII beyond status fields. Ordering/payment remain human-only.
 */
export async function GET(request: Request) {
  if (await isAgentReadLimited(request, 'agents_orders')) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu — thử lại sau ít phút.' },
      { status: 429 },
    )
  }

  const params = new URL(request.url).searchParams
  const orderCode = params.get('order_code')?.trim()
  const phone = params.get('phone')?.trim()
  if (!orderCode || !phone) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Cần cả mã đơn hàng và số điện thoại đặt hàng.' },
      { status: 400 },
    )
  }

  try {
    const order = await trackOrder(orderCode, phone)
    if (!order) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng khớp.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json(
      { code: 'ORDER_ERROR', message: 'Không tra cứu được đơn hàng lúc này.' },
      { status: 500 },
    )
  }
}
