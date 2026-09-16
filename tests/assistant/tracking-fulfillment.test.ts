import { describe, expect, it, vi } from 'vitest'

import {
  createDispatchContext,
  dispatchTool,
  TOOL_GET_FULFILLMENT,
  TOOL_TRACK_ORDER,
} from '@/lib/assistant/tools'

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({ products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 })),
  getProductBySlug: vi.fn(async () => null),
}))

const orderRow = {
  id: 'order-1',
  order_code: 'TS-ABC123',
  customer_phone: '0901234567',
  order_status: 'shipping',
  payment_status: 'paid',
  payment_method: 'cod',
  total: 20000000,
  created_at: '2026-01-01',
}

function chain(value: unknown) {
  const self: Record<string, unknown> & { data: unknown; error: null } = {
    data: value,
    error: null,
  } as Record<string, unknown> & { data: unknown; error: null }
  self.eq = () => self
  self.order = () => self
  self.limit = () => self
  self.maybeSingle = async () => ({ data: value, error: null })
  return self
}

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'orders') return chain(orderRow)
        if (table === 'order_items') return chain([{ quantity: 2 }])
        if (table === 'shipping_rates') {
          return chain({
            name: 'Tiêu chuẩn',
            base_rate: 30000,
            per_item_rate: 5000,
            free_threshold: 500000,
          })
        }
        if (table === 'stores') {
          return chain([
            {
              id: 's1',
              name: 'Cửa hàng 1',
              phone: null,
              province: 'TP.HCM',
              district: 'Quận 1',
              street_address: '1 Nguyễn Huệ',
              opening_hours: '8:00-22:00',
            },
          ])
        }
        return chain(null)
      },
    }),
  })),
}))

describe('tracking + fulfillment render wiring', () => {
  it('stores the tracking summary on ctx for inline render', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_TRACK_ORDER, {
      order_code: 'ts-abc123',
      phone: '0901234567',
    })
    expect(text).toContain('TS-ABC123')
    expect(ctx.tracking?.orderCode).toBe('TS-ABC123')
    expect(ctx.tracking?.itemCount).toBe(2)
  })

  it('stores fulfillment options on ctx for pre-checkout render', async () => {
    const ctx = createDispatchContext()
    const text = await dispatchTool(ctx, TOOL_GET_FULFILLMENT, { subtotal: 20000000, item_count: 2 })
    expect(text).toContain('fulfillment')
    expect(ctx.fulfillment?.delivery?.rate_name).toBe('Tiêu chuẩn')
    expect(ctx.fulfillment?.pickup_stores).toHaveLength(1)
  })
})
