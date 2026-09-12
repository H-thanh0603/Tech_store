import { describe, expect, it, vi } from 'vitest'

import {
  containsPhoneLike,
  extractMemoryFacts,
  loadMemoryFacts,
  mergeFacts,
  sessionKeyHash,
  updateMemory,
} from '@/lib/assistant/memory'
import { createDispatchContext, dispatchTool, TOOL_GET_FULFILLMENT } from '@/lib/assistant/tools'

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({ products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 })),
  getProductBySlug: vi.fn(async () => null),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => {
    throw new Error('use injected db in tests')
  }),
}))

function fakeMemoryDb(facts: unknown = {}) {
  const calls: string[] = []
  return {
    calls,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push('select')
            return { data: { facts }, error: null }
          },
        }),
      }),
      upsert: async () => {
        calls.push('upsert')
        return { error: null }
      },
    }),
  }
}

describe('memory extraction', () => {
  it('extracts budgets, use-cases and brands', () => {
    const facts = extractMemoryFacts(['Mình cần laptop học tập dưới 20 triệu, thích dell'])
    expect(facts.budget_vnd).toBe(20000000)
    expect(facts.use_cases).toContain('học tập / văn phòng')
    expect(facts.brands).toContain('dell')
  })

  it('parses k/tỷ units and skips phone-like text', () => {
    expect(extractMemoryFacts(['tầm 25k']).budget_vnd).toBeUndefined()
    expect(extractMemoryFacts(['khoảng 2 tỷ']).budget_vnd).toBeUndefined() // over the 500M cap
    expect(extractMemoryFacts(['khoảng 800k']).budget_vnd).toBe(800000)
    expect(containsPhoneLike('liên hệ 0901234567 nhé')).toBe(true)
    expect(extractMemoryFacts(['liên hệ 0901234567 nhé'])).toEqual({})
  })

  it('merges with latest budget winning', () => {
    const merged = mergeFacts(
      { budget_vnd: 15000000, use_cases: ['gaming'] },
      { budget_vnd: 20000000, brands: ['apple'] },
    )
    expect(merged.budget_vnd).toBe(20000000)
    expect(merged.use_cases).toEqual(['gaming'])
    expect(merged.brands).toEqual(['apple'])
  })

  it('hashes session ids and round-trips through the db', async () => {
    const key = await sessionKeyHash('session-abc-123')
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(await sessionKeyHash('short')).toBeNull()

    const db = fakeMemoryDb({ budget_vnd: 15000000 })
    expect(await loadMemoryFacts('k', db)).toEqual({ budget_vnd: 15000000 })
    const saved = await updateMemory('k', ['laptop gaming tầm 30 triệu'], db)
    expect(saved.budget_vnd).toBe(30000000)
    expect(db.calls).toContain('upsert')
  })
})

describe('get_fulfillment_options', () => {
  it('is registered and dispatches without throwing', async () => {
    const { buildAnthropicTools } = await import('@/lib/assistant/tools')
    expect(buildAnthropicTools().some((t) => t.name === TOOL_GET_FULFILLMENT)).toBe(true)
    const ctx = createDispatchContext()
    // No DB in unit env: admin client throws → dispatch returns fenced error.
    const text = await dispatchTool(ctx, TOOL_GET_FULFILLMENT, {})
    expect(text).toContain('storefront_data')
  })
})
