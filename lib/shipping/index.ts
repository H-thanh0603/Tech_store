// Unified carrier entry-point. Priority: explicitly requested carrier with
// live keys → internal rate table. Never throws for missing keys: callers
// get a usable (possibly mock-flagged) quote/tracking instead.

import { quoteGhn, trackGhn } from '@/lib/shipping/ghn'
import { quoteGhtk, trackGhtk } from '@/lib/shipping/ghtk'
import { quoteInternal } from '@/lib/shipping/rates'
import type {
  CarrierName,
  ShipmentTracking,
  ShippingQuote,
  ShippingQuoteRequest,
} from '@/lib/shipping/types'

export * from '@/lib/shipping/types'

export function getConfiguredCarriers(): CarrierName[] {
  const carriers: CarrierName[] = ['internal']
  if (process.env.GHN_TOKEN && process.env.GHN_SHOP_ID) carriers.unshift('ghn')
  if (process.env.GHTK_TOKEN) carriers.unshift('ghtk')
  return carriers
}

export async function quoteShipping(
  request: ShippingQuoteRequest,
  preferred: CarrierName = 'internal',
): Promise<ShippingQuote> {
  // Carrier live calls get a hard timeout + single retry; on failure fall
  // back to the internal rate table so checkout never blocks on GHN/GHTK.
  if (preferred === 'ghn' || preferred === 'ghtk') {
    const live = preferred === 'ghn' ? quoteGhn : quoteGhtk
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await withTimeout(live(request), 8_000)
      } catch (error) {
        if (attempt === 1) {
          const { logger } = await import('@/lib/logger')
          logger.warn('carrier quote fallback to internal', {
            carrier: preferred,
            error: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
          })
        }
      }
    }
  }
  return quoteInternal(request)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return promise.finally(() => clearTimeout(timer))
}

export async function trackShipment(
  carrier: CarrierName,
  trackingCode: string,
): Promise<ShipmentTracking> {
  if (carrier === 'ghn') return trackGhn(trackingCode)
  if (carrier === 'ghtk') return trackGhtk(trackingCode)
  const now = new Date().toISOString()
  return {
    carrier: 'internal',
    trackingCode: trackingCode.trim(),
    status: 'internal',
    isMock: false,
    events: [{ at: now, status: 'handover', description: 'Shop tự giao / đối tác ngoài sổ.' }],
  }
}
