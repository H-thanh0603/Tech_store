import { describe, expect, it } from 'vitest'

import { quoteInternal } from '@/lib/shipping/rates'
import { getConfiguredCarriers, quoteShipping, trackShipment } from '@/lib/shipping/index'

describe('internal shipping quote', () => {
  it('charges base + per-item below the free threshold', () => {
    const quote = quoteInternal({ province: '', district: '', ward: '', subtotal: 100000, itemCount: 3 })
    expect(quote.fee).toBe(25000 + 5000 * 2)
    expect(quote.carrier).toBe('internal')
  })

  it('is free above the threshold and zero for empty carts', () => {
    expect(
      quoteInternal({ province: '', district: '', ward: '', subtotal: 600000, itemCount: 2 }).fee,
    ).toBe(0)
    expect(
      quoteInternal({ province: '', district: '', ward: '', subtotal: 0, itemCount: 0 }).fee,
    ).toBe(0)
  })
})

describe('carrier adapters without keys', () => {
  it('falls back to mock quotes flagged isMock', async () => {
    const ghn = await quoteShipping(
      { province: 'HCM', district: 'Q1', ward: 'P1', subtotal: 100000, itemCount: 2 },
      'ghn',
    )
    expect(ghn.isMock).toBe(true)
    expect(ghn.fee).toBeGreaterThan(0)

    const ghtk = await quoteShipping(
      { province: 'HCM', district: 'Q1', ward: 'P1', subtotal: 100000, itemCount: 2 },
      'ghtk',
    )
    expect(ghtk.isMock).toBe(true)
  })

  it('lists only internal when no carrier keys are set', () => {
    // CI env has no GHN/GHTK keys.
    expect(getConfiguredCarriers()).toEqual(['internal'])
  })

  it('returns mock tracking events without keys', async () => {
    const tracking = await trackShipment('ghn', 'GHN123')
    expect(tracking.isMock).toBe(true)
    expect(tracking.events.length).toBeGreaterThan(0)
    await expect(trackShipment('ghn', '   ')).rejects.toThrow()
  })
})
