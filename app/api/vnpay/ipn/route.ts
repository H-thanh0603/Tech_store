import { NextResponse } from 'next/server'

import { handleVnpayCallback } from '@/lib/commerce/vnpay-callback'

// VNPay server-to-server IPN. Must answer JSON { RspCode, Message } per the
// VNPay integration spec. Idempotent: repeated calls hit the ALREADY_PAID
// guard in order_mark_paid_by_gateway and still report success.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })

  const result = await handleVnpayCallback(params)
  return NextResponse.json(
    { RspCode: result.ok ? '00' : '99', Message: result.message },
    { status: 200 },
  )
}
