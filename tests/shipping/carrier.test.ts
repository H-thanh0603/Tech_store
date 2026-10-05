import { afterEach, describe, expect, it } from 'vitest'

import { quoteGhn } from '@/lib/shipping/ghn'
import { quoteGhtk } from '@/lib/shipping/ghtk'
import { quoteInternal } from '@/lib/shipping/rates'
import { getConfiguredCarriers, quoteShipping, trackShipment } from '@/lib/shipping/index'

const CARRIER_ENV = [
  'GHN_TOKEN', 'GHN_SHOP_ID', 'GHN_FROM_DISTRICT_ID', 'GHN_FROM_WARD_CODE',
  'GHTK_TOKEN', 'GHTK_PICK_PROVINCE', 'GHTK_PICK_DISTRICT',
]

afterEach(() => {
  for (const key of CARRIER_ENV) delete process.env[key]
})

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

describe('carrier live paths (mocked transport)', () => {
  const request = { province: 'HCM', district: 'Q1', ward: 'P1', subtotal: 100000, itemCount: 2 }

  it('quotes the GHN live fee when sender codes + resolver exist', async () => {
    process.env.GHN_TOKEN = 'tok'
    process.env.GHN_SHOP_ID = 'shop'
    process.env.GHN_FROM_DISTRICT_ID = '1442'
    process.env.GHN_FROM_WARD_CODE = '20101'
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: 200, data: { total: 38500 } }))) as typeof fetch
    const quote = await quoteGhn(request, async () => ({ toDistrictId: 1442, toWardCode: '20101' }), fetchImpl)
    expect(quote).toMatchObject({ carrier: 'ghn', fee: 38500, isMock: false })
  })

  it('stays mock when GHN sender codes are missing', async () => {
    process.env.GHN_TOKEN = 'tok'
    process.env.GHN_SHOP_ID = 'shop'
    const quote = await quoteGhn(request, async () => ({ toDistrictId: 1442, toWardCode: '20101' }))
    expect(quote.isMock).toBe(true)
  })

  it('fails closed when GHN rejects the fee call', async () => {
    process.env.GHN_TOKEN = 'tok'
    process.env.GHN_SHOP_ID = 'shop'
    process.env.GHN_FROM_DISTRICT_ID = '1442'
    process.env.GHN_FROM_WARD_CODE = '20101'
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: 400, message: 'Invalid' }), { status: 400 })) as typeof fetch
    await expect(
      quoteGhn(request, async () => ({ toDistrictId: 1442, toWardCode: '20101' }), fetchImpl),
    ).rejects.toThrow(/GHN báo phí thất bại/)
  })

  it('quotes the GHTK live fee with sender names configured', async () => {
    process.env.GHTK_TOKEN = 'tok'
    process.env.GHTK_PICK_PROVINCE = 'HCM'
    process.env.GHTK_PICK_DISTRICT = 'Q1'
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: true, fee: { fee: 32000, delivery: true } }))) as typeof fetch
    const quote = await quoteGhtk(request, fetchImpl)
    expect(quote).toMatchObject({ carrier: 'ghtk', fee: 32000, isMock: false })
  })

  it('stays mock when GHTK sender names are missing', async () => {
    process.env.GHTK_TOKEN = 'tok'
    const quote = await quoteGhtk(request)
    expect(quote.isMock).toBe(true)
  })
})
