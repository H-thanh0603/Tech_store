import { describe, expect, it, vi } from 'vitest'

import { getAdminCoupon, listAdminCoupons } from '@/lib/admin/queries/coupons'

const fromCoupons = vi.fn()
const rpc = vi.fn()

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ from: fromCoupons, rpc }),
}))

const couponRow = {
  id: 'c1',
  code: 'SALE10',
  discount_type: 'percentage',
  discount_value: 10,
  minimum_order: 0,
  maximum_discount: null,
  starts_at: null,
  ends_at: null,
  usage_limit: 100,
  is_active: true,
  created_at: '2026-01-01',
}

function mockOk(usage: Record<string, number>) {
  fromCoupons.mockReturnValueOnce({
    select: () => ({ order: async () => ({ data: [couponRow], error: null }) }),
  })
  rpc.mockResolvedValueOnce({ data: usage, error: null })
}

describe('listAdminCoupons (RPC usage aggregate)', () => {
  it('attaches used counts without pulling redemption rows', async () => {
    mockOk({ c1: 7 })
    const rows = await listAdminCoupons()
    expect(rows).toHaveLength(1)
    expect(rows[0].usedCount).toBe(7)
    expect(rpc).toHaveBeenCalledWith('admin_coupon_usage')
  })

  it('defaults missing coupons to zero', async () => {
    mockOk({})
    const rows = await listAdminCoupons()
    expect(rows[0].usedCount).toBe(0)
  })

  it('getAdminCoupon finds by id', async () => {
    mockOk({ c1: 2 })
    expect((await getAdminCoupon('c1'))?.code).toBe('SALE10')
    mockOk({})
    expect(await getAdminCoupon('nope')).toBeNull()
  })
})
