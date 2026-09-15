import { describe, expect, it, vi } from 'vitest'

import { orderHistory } from '@/lib/assistant/backend'
import { createDispatchContext, dispatchTool, TOOL_ORDER_HISTORY } from '@/lib/assistant/tools'

const orders = [
  {
    id: 'order-2',
    order_code: 'TS-XYZ789',
    customer_phone: '0901234567',
    order_status: 'pending',
    payment_status: 'unpaid',
    total: 15000000,
    created_at: '2026-02-01',
  },
  {
    id: 'order-1',
    order_code: 'TS-ABC123',
    customer_phone: '0901234567',
    order_status: 'shipping',
    payment_status: 'paid',
    total: 20000000,
    created_at: '2026-01-01',
  },
]

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({ products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 })),
  getProductBySlug: vi.fn(async () => null),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            ilike: () => ({
              order: () => ({
                limit: async () => ({ data: orders, error: null }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: async () => ({ data: [{ quantity: 2 }], error: null }),
        }),
      }
    },
  })),
}))

describe('orderHistory', () => {
  it('returns recent phone-scoped orders with item counts', async () => {
    const history = await orderHistory('0901234567')
    expect(history).not.toBeNull()
    expect(history).toHaveLength(2)
    expect(history?.[0]?.orderCode).toBe('TS-XYZ789')
    expect(history?.[0]?.itemCount).toBe(2)
    expect(history?.[0]).not.toHaveProperty('customer_phone')
  })

  it('rejects invalid phones without querying', async () => {
    expect(await orderHistory('abc')).toBeNull()
    expect(await orderHistory('123')).toBeNull()
  })

  it('rejects short phone suffixes (H3 oracle guard)', async () => {
    // 8–9 digits must not match — only full 10-digit subscriber numbers.
    expect(await orderHistory('901234567')).toBeNull()
    expect(await orderHistory('01234567')).toBeNull()
  })
})

describe('get_order_history tool', () => {
  it('fences history results', async () => {
    const text = await dispatchTool(createDispatchContext(), TOOL_ORDER_HISTORY, { phone: '0901234567' })
    expect(text).toContain('storefront_data')
    expect(text).toContain('TS-ABC123')
  })

  it('holds invalid phones', async () => {
    const text = await dispatchTool(createDispatchContext(), TOOL_ORDER_HISTORY, { phone: '??' })
    expect(text).toContain('held')
  })
})
