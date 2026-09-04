import { describe, expect, it, vi } from 'vitest'

import { getDashboardStats } from '@/lib/admin/queries/dashboard'

const rpc = vi.fn()

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ rpc }),
}))

describe('getDashboardStats (RPC aggregate)', () => {
  it('maps the RPC json to DashboardStats', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        revenue7d: '150000000',
        newOrders7d: 12,
        pendingOrders: 3,
        lowStockCount: 2,
        draftProducts: 1,
      },
      error: null,
    })
    const stats = await getDashboardStats()
    expect(rpc).toHaveBeenCalledWith('admin_dashboard_stats_7d')
    expect(stats).toEqual({
      revenue7d: 150000000,
      newOrders7d: 12,
      pendingOrders: 3,
      lowStockCount: 2,
      draftProducts: 1,
    })
  })

  it('throws on RPC error instead of returning silent zeros', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('db down') })
    await expect(getDashboardStats()).rejects.toThrow()
  })
})
