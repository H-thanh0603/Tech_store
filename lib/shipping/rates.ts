import type { ShippingQuote, ShippingQuoteRequest } from '@/lib/shipping/types'

// Internal fallback quote. Mirrors the calculate_shipping RPC formula
// (active shipping_rates row: free over threshold, else base + per-item).
// Pure function so the checkout can quote without a DB round-trip; the
// transactional total is still computed server-side in place_order_internal.

export interface InternalRate {
  name: string
  baseRate: number
  perItemRate: number
  freeThreshold: number
}

export const DEFAULT_INTERNAL_RATE: InternalRate = {
  name: 'Tiêu chuẩn',
  baseRate: 25000,
  perItemRate: 5000,
  freeThreshold: 500000,
}

export function quoteInternal(
  request: ShippingQuoteRequest,
  rate: InternalRate = DEFAULT_INTERNAL_RATE,
): ShippingQuote {
  const subtotal = Math.max(0, Math.floor(request.subtotal))
  const itemCount = Math.max(0, Math.floor(request.itemCount))
  if (itemCount === 0) {
    return { carrier: 'internal', service: rate.name, fee: 0, etaDays: 0, isMock: false }
  }
  const free = rate.freeThreshold > 0 && subtotal >= rate.freeThreshold
  return {
    carrier: 'internal',
    service: rate.name,
    fee: free ? 0 : rate.baseRate + rate.perItemRate * Math.max(itemCount - 1, 0),
    etaDays: 3,
    isMock: false,
  }
}
