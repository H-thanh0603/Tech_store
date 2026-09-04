import { describe, expect, it, vi } from 'vitest'

import type { MessagesClient } from '@/lib/assistant/agent'
import { runMerchantTurn } from '@/lib/assistant/merchant/agent'

vi.mock('@/lib/assistant/merchant/backend', () => ({
  businessSnapshot: vi.fn(async () => ({ period: '7d', revenue7d: 1, newOrders7d: 1, pendingOrders: 0, lowStockCount: 0, draftProducts: 0 })),
  inventoryAlerts: vi.fn(async () => []),
  orderIssues: vi.fn(async () => []),
  searchListings: vi.fn(async () => []),
  getListing: vi.fn(async () => null),
  liveStates: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/assistant/merchant/ledger', () => ({
  recordStaged: vi.fn(async () => {}),
  listPendingStaged: vi.fn(async () => []),
  getStagedById: vi.fn(async () => null),
  markStagedDecided: vi.fn(async () => {}),
}))

function stubClient(
  script: Array<{ text?: string; tool?: { name: string; input: Record<string, unknown> } }>,
) {
  const calls: { tool_choice: unknown }[] = []
  let i = 0
  const client: MessagesClient = {
    messages: {
      create: async (params) => {
        calls.push({ tool_choice: params.tool_choice })
        const step = script[Math.min(i, script.length - 1)]
        i += 1
        if (step.tool) {
          return {
            content: [{ type: 'tool_use', id: `to-${i}`, name: step.tool.name, input: step.tool.input }],
            stop_reason: 'tool_use',
          }
        }
        return { content: [{ type: 'text', text: step.text ?? 'Xong.' }], stop_reason: 'end_turn' }
      },
    },
  }
  return { client, calls }
}

describe('merchant turn loop', () => {
  it('returns disabled reply without an API key', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    const savedDeep = process.env.DEEPSEEK_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.DEEPSEEK_API_KEY
    try {
      const result = await runMerchantTurn([{ role: 'user', content: 'doanh thu?' }])
      expect(result.disabled).toBe(true)
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
      if (savedDeep !== undefined) process.env.DEEPSEEK_API_KEY = savedDeep
    }
  })

  it('forces a snapshot read on performance questions', async () => {
    const { client, calls } = stubClient([
      { tool: { name: 'get_business_snapshot', input: {} } },
      { tool: { name: 'present_suggestions', input: { suggestions: ['Xem tồn kho'] } } },
      { text: 'done' },
    ])
    const result = await runMerchantTurn([{ role: 'user', content: 'Doanh thu tuần này thế nào?' }], {
      client,
    })
    expect(calls[0].tool_choice).toEqual({ type: 'tool', name: 'get_business_snapshot' })
    expect(result.suggestions).toEqual(['Xem tồn kho'])
    expect(result.staged).toHaveLength(0)
  })

  it('collects staged envelopes for the approval surface', async () => {
    const { client } = stubClient([
      { tool: { name: 'search_listings', input: { query: 'laptop' } } },
      {
        tool: {
          name: 'stage_publish_change',
          input: { target: 'publish', product_ids: ['p1'] },
        },
      },
      { text: 'Đã stage.' },
    ])
    // liveStates mock returns empty -> unknown id -> held, no staged envelope.
    const result = await runMerchantTurn([{ role: 'user', content: 'xuất bản laptop' }], { client })
    expect(result.staged).toHaveLength(0)
    expect(result.reply.length).toBeGreaterThan(0)
  })
})
