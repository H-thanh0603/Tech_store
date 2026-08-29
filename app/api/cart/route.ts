import { NextResponse } from 'next/server'

import { getCart } from '@/lib/commerce/queries'

// Per-visitor cart payload for the client header. Reads the cart cookie,
// so it is dynamic by design and must never be cached at the edge.
export async function GET() {
  const cart = await getCart()
  return NextResponse.json(cart, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
