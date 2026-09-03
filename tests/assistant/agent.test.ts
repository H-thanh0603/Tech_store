import { describe, expect, it, vi } from 'vitest'

import { runAssistantTurn, type MessagesClient } from '@/lib/assistant/agent'

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({
    products: [],
    total: 0,
    page: 1,
    pageSize: 12,
    pageCount: 1,
  })),
  getProductBySlug: vi.fn(async () => null),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => {
    throw new Error('no db in agent test')
  }),
}))

function stubClient(script: Array<{ text?: string; tool?: { name: string; input: Record<string, unknown> } }>) {
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
            content: [
              { type: 'tool_use', id: `to-${i}`, name: step.tool.name, input: step.tool.input },
            ],
            stop_reason: 'tool_use',
          }
        }
        return { content: [{ type: 'text', text: step.text ?? 'Xin chào!' }], stop_reason: 'end_turn' }
      },
    },
  }
  return { client, calls }
}

describe('assistant turn loop', () => {
  it('returns disabled reply without an API key', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const result = await runAssistantTurn([{ role: 'user', content: 'hi' }])
      expect(result.disabled).toBe(true)
      expect(result.reply).toMatch(/chưa được cấu hình/)
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
    }
  })

  it('forces a policy read on policy questions', async () => {
    const { client, calls } = stubClient([
      { tool: { name: 'search_policies', input: { query: 'đổi trả' } } },
      { tool: { name: 'present_suggestions', input: { suggestions: ['Xem điện thoại'] } } },
      { text: 'done' },
    ])
    const result = await runAssistantTurn(
      [{ role: 'user', content: 'Chính sách đổi trả thế nào?' }],
      { client },
    )
    expect(calls[0].tool_choice).toEqual({ type: 'tool', name: 'search_policies' })
    expect(result.suggestions).toEqual(['Xem điện thoại'])
  })

  it('runs tools then answers with text', async () => {
    const { client } = stubClient([
      { tool: { name: 'search_products', input: { query: 'laptop' } } },
      { text: 'Đây là gợi ý cho bạn.' },
    ])
    const result = await runAssistantTurn([{ role: 'user', content: 'tìm laptop' }], { client })
    expect(result.reply).toContain('gợi ý')
  })

  it('stops after the iteration ceiling', async () => {
    const { client, calls } = stubClient([
      { tool: { name: 'search_products', input: { query: 'x' } } },
    ])
    await runAssistantTurn([{ role: 'user', content: 'tìm x' }], { client })
    // 5 tool rounds + 1 forced-text round.
    expect(calls.length).toBe(6)
    expect(calls[calls.length - 1].tool_choice).toEqual({ type: 'none' })
  })

  it('survives model errors with a friendly message', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () => {
          throw new Error('overloaded')
        },
      },
    }
    const result = await runAssistantTurn([{ role: 'user', content: 'hi' }], { client })
    expect(result.reply).toMatch(/bận|thử lại/)
  })
})
