import { describe, expect, it, vi } from 'vitest'

import {
  createDispatchContext,
  dispatchTool,
  TOOL_COMPARE_PRODUCTS,
  TOOL_CREATE_PLAN,
} from '@/lib/assistant/tools'

const iphone = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: 'Điện thoại Apple',
  categoryId: 'c1',
  categorySlug: 'dien-thoai',
  categoryName: 'Điện thoại',
  brandName: 'Apple',
  isFeatured: true,
  images: [{ url: '/img/iphone.jpg', alt: 'iPhone 15' }],
  variants: [{ id: 'var-1' }],
  specs: [{ group: 'Màn hình', label: 'Kích thước', value: '6.1 inch' }],
  useCases: [],
  minPrice: 20000000,
  hasDiscount: true,
  availableStock: 5,
  inStock: true,
}

const pixel = {
  ...iphone,
  id: 'prod-2',
  name: 'Pixel 9',
  slug: 'pixel-9',
  brandName: 'Google',
  minPrice: 18000000,
  hasDiscount: false,
}

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({ products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 })),
  getProductBySlug: vi.fn(async (slug: string) => {
    if (slug === 'iphone-15') return iphone
    if (slug === 'pixel-9') return pixel
    return null
  }),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: () => {
      throw new Error('not used here')
    },
  })),
}))

describe('compare_products', () => {
  it('compares 2 slugs with a cheapest summary', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_COMPARE_PRODUCTS, { identifiers: ['iphone-15', 'pixel-9'] })
    const payload = JSON.parse(text.replace(/^<storefront_data>\n?/, '').replace(/\n?<\/storefront_data>$/, ''))
    expect(payload.result).toBe('ok')
    expect(payload.rows).toHaveLength(2)
    expect(payload.summary.cheapest.slug).toBe('pixel-9')
    expect(payload.summary.inStock).toEqual(['iphone-15', 'pixel-9'])
    expect(ctx.cards).toHaveLength(2)
  })

  it('reports unknown identifiers instead of guessing', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_COMPARE_PRODUCTS, { identifiers: ['iphone-15', 'nope-xyz'] })
    const payload = JSON.parse(text.replace(/^<storefront_data>\n?/, '').replace(/\n?<\/storefront_data>$/, ''))
    expect(payload.rows).toHaveLength(1)
    expect(payload.unknownIdentifiers).toEqual(['nope-xyz'])
  })

  it('rejects fewer than 2 identifiers', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_COMPARE_PRODUCTS, { identifiers: ['iphone-15'] })
    expect(text).toContain('2–4')
  })

  it('rejects unseen opaque ids (provenance gate)', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_COMPARE_PRODUCTS, {
      identifiers: ['iphone-15', '123e4567-e89b-12d3-a456-426614174000'],
    })
    const payload = JSON.parse(text.replace(/^<storefront_data>\n?/, '').replace(/\n?<\/storefront_data>$/, ''))
    expect(payload.unknownIdentifiers).toEqual(['123e4567-e89b-12d3-a456-426614174000'])
  })
})

describe('create_shopping_plan', () => {
  it('prices lines against a budget', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_CREATE_PLAN, {
      title: 'Setup học tập',
      budget: 50000000,
      lines: [
        { identifier: 'iphone-15', quantity: 1 },
        { identifier: 'pixel-9', quantity: 2 },
      ],
    })
    const payload = JSON.parse(text.replace(/^<storefront_data>\n?/, '').replace(/\n?<\/storefront_data>$/, ''))
    expect(payload.plan.total).toBe(20000000 + 2 * 18000000)
    expect(payload.plan.overBudget).toBe(true)
    expect(payload.plan.rejected).toEqual([])
  })

  it('rejects bad quantities and unknown products', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_CREATE_PLAN, {
      lines: [
        { identifier: 'iphone-15', quantity: 99 },
        { identifier: 'ghost', quantity: 1 },
      ],
    })
    const payload = JSON.parse(text.replace(/^<storefront_data>\n?/, '').replace(/\n?<\/storefront_data>$/, ''))
    expect(payload.plan.lines).toHaveLength(0)
    expect(payload.plan.rejected).toHaveLength(2)
  })
})
