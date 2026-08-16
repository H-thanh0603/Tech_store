import { NextResponse } from 'next/server'

import { handleVnpayCallback } from '@/lib/commerce/vnpay-callback'

// Browser redirect back from VNPay. Verifies the signature, marks the order
// paid when valid, then sends the customer to the confirmation page. The
// server-to-server IPN route is the authoritative confirmation; this route is
// a best-effort duplicate that also handles the user experience.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })

  const result = await handleVnpayCallback(params)
  const orderCode = result.orderCode ?? params.vnp_TxnRef ?? ''

  if (result.ok && orderCode) {
    return NextResponse.redirect(
      new URL(`/orders/${encodeURIComponent(orderCode)}/confirmation`, url.origin),
    )
  }
  // Failed/cancelled payment: back to the order confirmation page, which
  // shows the awaiting_payment state and payment instructions.
  if (orderCode) {
    return NextResponse.redirect(
      new URL(
        `/orders/${encodeURIComponent(orderCode)}/confirmation?vnpay=failed`,
        url.origin,
      ),
    )
  }
  return NextResponse.redirect(new URL('/track-order', url.origin))
}
