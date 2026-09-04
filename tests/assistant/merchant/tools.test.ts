import { describe, expect, it, vi } from 'vitest'

import {
  createMerchantContext,
  dispatchMerchantTool,
  TOOL_ALERTS,
  TOOL_GET_LISTING,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_SEARCH_LISTINGS,
  TOOL_SNAPSHOT,
  TOOL_STAGE_PRICE,
} from '@/lib/assistant/merchant/tools'

vi.mock('@/lib/assistant/merchant/backend', () => ({
  businessSnapshot: vi.fn(async () => ({
    period: '7 ngày gần nhất',
    revenue7d: 100_000_000,
    newOrders7d: 12,
    pendingOrders: 3,
    lowStockCount: 2,
    draftProducts: 1,
  })),
  inventoryAlerts: vi.fn(async () => []),
  orderIssues: vi.fn(async () => []),
  searchListings: vi.fn(async (query: string) =>
    query === 'laptop'
      ? [
          {
            product_id: 'p1',
            name: 'Laptop A',
            slug: 'laptop-a',
            isPublished: true,
            isArchived: false,
            minPrice: 10_000_000,
            totalAvailable: 5,
          },
        ]
      : [],
  ),
  getListing: vi.fn(async (id: string) =>
    id === 'p1'
      ? {
          product_id: 'p1',
          name: 'Laptop A',
          slug: 'laptop-a',
          isPublished: true,
          isArchived: false,
          minPrice: 10_000_000,
          totalAvailable: 5,
          variants: [{ id: 'v1', sku: 'SKU1', price: 10_000_000, available: 5 }],
        }
      : null,
  ),
  liveStates: vi.fn(async (ids: string[]) => {
    const map = new Map()
    if (ids.includes('p1')) {
      map.set('p1', { productId: 'p1', name: 'Laptop A', minPrice: 10_000_000, availableStock: 5 })
    }
    return map
  }),
}))

describe('merchant tool dispatcher', () => {
  it('reports the business snapshot', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, TOOL_SNAPSHOT, {})
    expect(text).toContain('100000000')
  })

  it('searches listings and remembers ids', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, TOOL_SEARCH_LISTINGS, { query: 'laptop' })
    expect(text).toContain('Laptop A')
    expect(ctx.seenListingIds.has('p1')).toBe(true)
  })

  it('reads listing details', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, TOOL_GET_LISTING, { product_id: 'p1' })
    expect(text).toContain('Laptop A')
  })

  it('holds staging for ids never read this turn', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, TOOL_STAGE_PRICE, {
      product_ids: ['ghost'],
      mode: 'percent_down',
      value: 10,
    })
    expect(text).toContain('held')
  })

  it('stages a guarded price change for read ids', async () => {
    const ctx = createMerchantContext()
    await dispatchMerchantTool(ctx, TOOL_SEARCH_LISTINGS, { query: 'laptop' })
    const out = await dispatchMerchantTool(ctx, TOOL_STAGE_PRICE, {
      product_ids: ['p1'],
      mode: 'percent_down',
      value: 10,
    })
    expect(out.text).toContain('staged')
    expect(out.signed?.change.summary).toMatch(/Giảm giá 10%/)
    expect(ctx.stagedIds).toHaveLength(1)
  })

  it('holds price changes over the guardrail cap', async () => {
    const ctx = createMerchantContext()
    await dispatchMerchantTool(ctx, TOOL_SEARCH_LISTINGS, { query: 'laptop' })
    const { text } = await dispatchMerchantTool(ctx, TOOL_STAGE_PRICE, {
      product_ids: ['p1'],
      mode: 'percent_down',
      value: 50,
    })
    expect(text).toContain('held')
  })

  it('records suggestions and ends the turn', async () => {
    const ctx = createMerchantContext()
    await dispatchMerchantTool(ctx, TOOL_PRESENT_SUGGESTIONS, { suggestions: ['Duyệt change'] })
    expect(ctx.suggestions).toEqual(['Duyệt change'])
    expect(ctx.endTurn).toBe(true)
  })

  it('never throws on unknown tools', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, 'apply_change', {})
    expect(text).toContain('error')
  })

  it('exposes inventory alerts', async () => {
    const ctx = createMerchantContext()
    const { text } = await dispatchMerchantTool(ctx, TOOL_ALERTS, {})
    expect(text).toContain('alerts')
  })
})
