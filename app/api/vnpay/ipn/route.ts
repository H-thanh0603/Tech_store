import { NextResponse } from 'next/server'

import { handleVnpayCallback } from '@/lib/commerce/vnpay-callback'

// VNPay server-to-server IPN. Must answer JSON { RspCode, Message } per the
// VNPay integration spec. Idempotent: repeated calls hit the ALREADY_PAID
// guard in order_mark_paid_by_gateway and still report success.
export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const url = new URL(request.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })

  // Debug aid: log raw IPN query trừ chữ ký + số tiền rút gọn, kèm request-id
  // để đối soát VNPay khi khiếu nại. Không log full SecureHash.
  const { logger } = await import('@/lib/logger')
  const safe: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') continue
    safe[key] = value
  }
  logger.info('vnpay ipn received', {
    requestId,
    orderCode: params.vnp_TxnRef ?? null,
    responseCode: params.vnp_ResponseCode ?? null,
    params: safe,
  })

  const result = await handleVnpayCallback(params)
  if (!result.ok) {
    logger.warn('vnpay ipn rejected', {
      requestId,
      orderCode: result.orderCode,
      message: result.message,
      code: result.ipnResponseCode,
    })
  }
  return NextResponse.json(
    { RspCode: result.ipnResponseCode, Message: result.message },
    { status: 200, headers: { 'x-request-id': requestId } },
  )
}
