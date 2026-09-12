import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/assistant/merchant/backend', () => ({
  businessSnapshot: vi.fn(async () => ({
    period: '7 ngày gần nhất',
    revenue7d: 100000000,
    newOrders7d: 25,
    pendingOrders: 4,
    lowStockCount: 3,
    draftProducts: 1,
  })),
  inventoryAlerts: vi.fn(async () => [
    { productId: 'p1', name: 'Pin X', sku: 'PIN-X', available: 2, threshold: 5, status: 'low_stock' },
  ]),
  orderIssues: vi.fn(async () => [
    { orderCode: 'TS-1', orderStatus: 'pending', paymentStatus: 'pending', total: 1000000, createdAt: '2026-09-01' },
  ]),
}))

const briefRow = {
  id: 'brief-1',
  title: 'Sale 9.9',
  mechanic: 'percent_off',
  discount_pct: 10,
  starts_at: '2026-09-09',
  ends_at: '2026-09-12',
  rationale: 'Xả hàng tồn',
  execution: 'Tạo coupon SALE99 10%',
  status: 'proposed',
  created_at: '2026-09-01',
}

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'campaign_briefs') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: briefRow, error: null }) }) }),
          select: () => ({
            eq: () => ({ order: () => ({ limit: async () => ({ data: [briefRow], error: null }) }) }),
            order: () => ({ limit: async () => ({ data: [briefRow], error: null }) }),
          }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }
      }
      if (table === 'merchant_digests') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'digest-1' }, error: null }) }) }),
          select: () => ({
            order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          }),
        }
      }
      if (table === 'orders') {
        return {
          select: () => ({
            gte: () => ({ not: () => ({ limit: async () => ({ data: [{ payment_method: 'cod', total: 1000000 }], error: null }) }) }),
          }),
        }
      }
      return {
        select: () => ({ limit: async () => ({ data: [{ category_id: 'c1', is_published: true }], error: null }) }),
      }
    },
  })),
}))

describe('campaign briefs', () => {
  it('validates guardrails before touching the db', async () => {
    const { validateBrief, draftCampaignBrief, listCampaignBriefs, decideCampaignBrief } = await import(
      '@/lib/assistant/merchant/campaigns'
    )
    expect(validateBrief({ title: 'x', mechanic: 'percent_off', execution: 'làm tay' })).toContain('4–120')
    expect(validateBrief({ title: 'Sale 9.9', mechanic: 'rocket', execution: 'làm tay' })).toContain('mechanic')
    expect(validateBrief({ title: 'Sale 9.9', mechanic: 'percent_off', discount_pct: 80, execution: 'làm tay' })).toContain('50%')

    const drafted = await draftCampaignBrief(
      { title: 'Sale 9.9', mechanic: 'percent_off', discount_pct: 10, execution: 'Tạo coupon SALE99' },
      'manager',
    )
    expect(drafted.brief?.id).toBe('brief-1')
    expect(await listCampaignBriefs()).toHaveLength(1)
    expect((await decideCampaignBrief('brief-1', 'approve', 'admin')).ok).toBe(true)
  })
})

describe('analysis delegate', () => {
  it('runs allowlisted templates and rejects the rest', async () => {
    const { runAnalysis, ANALYSIS_TEMPLATES } = await import('@/lib/assistant/merchant/analysis')
    expect(ANALYSIS_TEMPLATES).toContain('revenue_by_payment')

    const revenue = await runAnalysis('revenue_by_payment')
    expect(revenue.result?.rows).toEqual([{ payment_method: 'cod', orders: 1, revenue: 1000000 }])

    const mix = await runAnalysis('category_mix')
    expect(mix.result?.rows).toEqual([{ category_id: 'c1', total: 1, published: 1 }])

    const snap = await runAnalysis('snapshot')
    expect(snap.result?.summary).toContain('25')

    const bad = await runAnalysis('select * from users')
    expect(bad.result).toBeNull()
  })
})

describe('merchant digest', () => {
  it('composes and reads back digests', async () => {
    const { composeDigest, latestDigest } = await import('@/lib/assistant/merchant/digest')
    const composed = await composeDigest()
    expect(composed.ok).toBe(true)
    expect(composed.id).toBe('digest-1')
    // No digest row in this mock → empty state, not a throw.
    expect(await latestDigest()).toBeNull()
  })
})

describe('merchant new tools dispatch', () => {
  it('registers campaign/analysis/digest tools and dispatches them', async () => {
    const tools = await import('@/lib/assistant/merchant/tools')
    const defs = tools.buildMerchantTools().map((t) => t.name)
    for (const name of ['draft_campaign_brief', 'list_campaign_briefs', 'run_analysis', 'get_latest_digest']) {
      expect(defs).toContain(name)
    }
    const ctx = tools.createMerchantContext('user-1')
    const drafted = await tools.dispatchMerchantTool(ctx, 'draft_campaign_brief', {
      title: 'Sale 9.9',
      mechanic: 'percent_off',
      discount_pct: 10,
      execution: 'Tạo coupon SALE99',
    })
    expect(drafted.text).toContain('staged')
    const listed = await tools.dispatchMerchantTool(ctx, 'list_campaign_briefs', {})
    expect(listed.text).toContain('brief-1')
    const analyzed = await tools.dispatchMerchantTool(ctx, 'run_analysis', { template: 'low_stock' })
    expect(analyzed.text).toContain('low_stock')
  })
})
