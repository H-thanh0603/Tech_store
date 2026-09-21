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

function stubClient(
  script: Array<{ text?: string; tool?: { name: string; input: Record<string, unknown> } }>,
) {
  const calls: { tool_choice: unknown; tools: string[] }[] = []
  let i = 0
  const client: MessagesClient = {
    messages: {
      create: async (params) => {
        calls.push({ tool_choice: params.tool_choice, tools: params.tools.map((t) => t.name) })
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
        return {
          content: [{ type: 'text', text: step.text ?? 'Xin chào!' }],
          stop_reason: 'end_turn',
        }
      },
    },
  }
  return { client, calls }
}

describe('assistant turn loop', () => {
  it('returns disabled reply without an API key', async () => {
    // Credentials are injected from `.env.assistant` by the test setup, so to
    // assert the "not configured" path we clear every provider + key and force
    // the default (anthropic) provider, then restore exactly what was set.
    const saved = {
      provider: process.env.ASSISTANT_PROVIDER,
      model: process.env.ASSISTANT_MODEL,
      anthropic: process.env.ANTHROPIC_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
      tokenrouter: process.env.TOKENROUTER_API_KEY,
    }
    delete process.env.ASSISTANT_PROVIDER
    delete process.env.ASSISTANT_MODEL
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.OPENROUTER_API_KEY
    delete process.env.TOKENROUTER_API_KEY
    try {
      const result = await runAssistantTurn([{ role: 'user', content: 'hi' }])
      expect(result.disabled).toBe(true)
      expect(result.reply).toMatch(/chưa được cấu hình/)
    } finally {
      const restore = (k: string, v: string | undefined) => {
        if (v !== undefined) process.env[k] = v
        else delete process.env[k]
      }
      restore('ASSISTANT_PROVIDER', saved.provider)
      restore('ASSISTANT_MODEL', saved.model)
      restore('ANTHROPIC_API_KEY', saved.anthropic)
      restore('DEEPSEEK_API_KEY', saved.deepseek)
      restore('OPENROUTER_API_KEY', saved.openrouter)
      restore('TOKENROUTER_API_KEY', saved.tokenrouter)
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

  it('sends only the needed tool buckets to the model', async () => {
    const { client, calls } = stubClient([
      { tool: { name: 'track_order', input: { order_code: 'TS-ABC123', phone: '0901234567' } } },
      { text: 'Đơn của bạn đang giao.' },
    ])
    vi.stubEnv('JEV_TOOL_FILTER', '1')
    await runAssistantTurn(
      [{ role: 'user', content: 'Đơn TS-ABC123 tới đâu rồi, SĐT 0901234567' }],
      { client },
    )
    vi.unstubAllEnvs()
    expect(calls[0].tools).toContain('track_order')
    expect(calls[0].tools).toContain('present_suggestions')
    expect(calls[0].tools).not.toContain('search_products')
    expect(calls[0].tools).not.toContain('add_to_cart')
  })

  it('inherits buckets for gray follow-ups and reports the filter summary', async () => {
    const { client, calls } = stubClient([
      { tool: { name: 'get_product_details', input: { identifier: 'iphone-15' } } },
      { text: 'Chi tiết món thứ 2 đây.' },
    ])
    vi.stubEnv('JEV_TOOL_FILTER', '1')
    vi.stubEnv('JEV_API_KEY', 'test-key')
    const result = await runAssistantTurn(
      [
        { role: 'user', content: 'tìm laptop dưới 20 triệu' },
        { role: 'assistant', content: 'Mình tìm được vài món.' },
        { role: 'user', content: 'cái thứ 2 thì sao' },
      ],
      { client },
    )
    vi.unstubAllEnvs()
    expect(calls[0].tools).toContain('search_products')
    expect(calls[0].tools).not.toContain('track_order')
    expect(result.toolFilter).toMatchObject({ source: 'history', buckets: ['catalog'] })
    expect(result.toolFilter!.sent).toBeLessThan(result.toolFilter!.full)
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
