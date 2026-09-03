import { describe, expect, it, vi } from 'vitest'

import {
  createDispatchContext,
  dispatchTool,
  TOOL_GET_PRODUCT_DETAILS,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_SEARCH_POLICIES,
  TOOL_SEARCH_PRODUCTS,
  TOOL_TRACK_ORDER,
} from '@/lib/assistant/tools'

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({
    products: [
      {
        id: 'prod-1',
        name: 'iPhone 15',
        slug: 'iphone-15',
        categorySlug: 'dien-thoai',
        brandName: 'Apple',
        minPrice: 20000000,
        hasDiscount: true,
        availableStock: 5,
        inStock: true,
        imageUrl: '/img/iphone.jpg',
        imageAlt: 'iPhone 15',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 12,
    pageCount: 1,
  })),
  getProductBySlug: vi.fn(async (slug: string) =>
    slug === 'iphone-15'
      ? {
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
          variants: [],
          specs: [],
          useCases: [],
          minPrice: 20000000,
          hasDiscount: true,
          availableStock: 5,
          inStock: true,
        }
      : null,
  ),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'order-1',
              order_code: 'TS-ABC123',
              customer_phone: '0901234567',
              order_status: 'shipping',
              payment_status: 'paid',
              payment_method: 'cod',
              total: 20000000,
              created_at: '2026-01-01',
            },
            error: null,
          }),
        }),
      }),
    }),
  })),
}))

describe('assistant tool dispatcher', () => {
  it('searches products and remembers ids for cards', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_SEARCH_PRODUCTS, { query: 'iphone' })
    expect(text).toContain('storefront_data')
    expect(text).toContain('iPhone 15')
    expect(ctx.cards).toHaveLength(1)
    expect(ctx.seenIds.get('prod-1')).toBe('iphone-15')
  })

  it('resolves product details and records variants', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_GET_PRODUCT_DETAILS, { identifier: 'iphone-15' })
    expect(text).toContain('iPhone 15')
    expect(ctx.cards).toHaveLength(1)
  })

  it('reports not_found for unknown products', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_GET_PRODUCT_DETAILS, { identifier: 'nope' })
    expect(text).toContain('not_found')
    expect(ctx.cards).toHaveLength(0)
  })

  it('tracks phone-verified orders', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_TRACK_ORDER, {
      order_code: 'ts-abc123',
      phone: '0901234567',
    })
    expect(text).toContain('TS-ABC123')
    expect(text).toContain('shipping')
  })

  it('rejects mismatched phones', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_TRACK_ORDER, {
      order_code: 'TS-ABC123',
      phone: '0900000000',
    })
    expect(text).toContain('not_found')
  })

  it('answers policies from static passages only', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_SEARCH_POLICIES, { query: 'đổi trả bao lâu' })
    expect(text).toContain('7 ngày')
  })

  it('records suggestions and ends the turn', async () => {
    const ctx = createDispatchContext()
    await dispatchTool(ctx, TOOL_PRESENT_SUGGESTIONS, { suggestions: ['Xem iPhone 15', 'So sánh'] })
    expect(ctx.suggestions).toHaveLength(2)
    expect(ctx.endTurn).toBe(true)
  })

  it('never throws on unknown tools', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, 'delete_everything', {})
    expect(text).toContain('error')
  })
})
