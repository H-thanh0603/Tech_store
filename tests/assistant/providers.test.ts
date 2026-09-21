import { describe, expect, it, vi } from 'vitest'

import {
  createProviderClient,
  defaultModelFor,
  _resetGlmTextSeqForTests,
  extractGlmToolCalls,
  fetchWithRetry,
  fromDeepSeekResponse,
  isUnsupportedReasonerModel,
  resolveProvider,
  toDeepSeekRequest,
} from '@/lib/assistant/providers'

const baseParams = {
  model: 'deepseek-chat',
  max_tokens: 100,
  system: 'Bạn là trợ lý.',
  tools: [
    {
      name: 'search_products',
      description: 'Tìm sản phẩm',
      input_schema: { type: 'object' as const, properties: { query: { type: 'string' } } },
    },
  ],
  tool_choice: { type: 'auto' as const },
  messages: [{ role: 'user' as const, content: 'tìm laptop' }],
}

describe('assistant providers', () => {
  it('defaults to anthropic, switches on env', () => {
    // The assistant credentials come from `.env.assistant` (loaded once by the
    // test setup), so the model-provider defaults read them off process.env.
    // Isolate this test by saving/restoring the env it mutates.
    const savedProvider = process.env.ASSISTANT_PROVIDER
    const savedModel = process.env.ASSISTANT_MODEL
    delete process.env.ASSISTANT_PROVIDER
    delete process.env.ASSISTANT_MODEL
    expect(resolveProvider()).toBe('anthropic')
    process.env.ASSISTANT_PROVIDER = 'deepseek'
    expect(resolveProvider()).toBe('deepseek')
    expect(defaultModelFor('deepseek')).toBe('deepseek-chat')
    expect(defaultModelFor('anthropic')).toBe('claude-haiku-4-5')
    process.env.ASSISTANT_PROVIDER = 'openrouter'
    expect(resolveProvider()).toBe('openrouter')
    expect(defaultModelFor('openrouter')).toBe('anthropic/claude-haiku-4-5')
    if (savedProvider === undefined) delete process.env.ASSISTANT_PROVIDER
    else process.env.ASSISTANT_PROVIDER = savedProvider
    if (savedModel === undefined) delete process.env.ASSISTANT_MODEL
    else process.env.ASSISTANT_MODEL = savedModel
  })

  it('builds an OpenRouter client only when its key is set', () => {
    const savedProvider = process.env.ASSISTANT_PROVIDER
    const savedKey = process.env.OPENROUTER_API_KEY
    process.env.ASSISTANT_PROVIDER = 'openrouter'
    delete process.env.OPENROUTER_API_KEY
    expect(createProviderClient()).toBeNull()
    process.env.OPENROUTER_API_KEY = 'test-key'
    expect(createProviderClient()).not.toBeNull()
    if (savedProvider === undefined) delete process.env.ASSISTANT_PROVIDER
    else process.env.ASSISTANT_PROVIDER = savedProvider
    if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = savedKey
  })

  it('translates system/history/tools to DeepSeek chat format', () => {
    const req = toDeepSeekRequest(baseParams) as {
      messages: { role: string; content: string | null }[]
      tools: { type: string; function: { name: string } }[]
      tool_choice: unknown
    }
    expect(req.messages[0]).toEqual({ role: 'system', content: 'Bạn là trợ lý.' })
    expect(req.messages[1]).toEqual({ role: 'user', content: 'tìm laptop' })
    expect(req.tools[0].function.name).toBe('search_products')
    expect(req.tool_choice).toBe('auto')
  })

  it('maps forced Anthropic tool choice to DeepSeek function choice', () => {
    const req = toDeepSeekRequest({
      ...baseParams,
      tool_choice: { type: 'tool', name: 'search_policies' },
    }) as { tool_choice: unknown }
    expect(req.tool_choice).toEqual({ type: 'function', function: { name: 'search_policies' } })
  })

  it('converts assistant tool_use blocks to tool_calls', () => {
    const req = toDeepSeekRequest({
      ...baseParams,
      messages: [
        { role: 'user', content: 'đổi trả?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'to-1', name: 'search_policies', input: { query: 'đổi trả' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'to-1', content: 'ok' }],
        },
      ],
    }) as { messages: { role: string; tool_calls?: { id: string }[]; tool_call_id?: string }[] }
    expect(req.messages[2].tool_calls?.[0].id).toBe('to-1')
    expect(req.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'to-1' })
  })

  it('converts DeepSeek tool_calls back to tool_use blocks', () => {
    const out = fromDeepSeekResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                function: { name: 'search_products', arguments: '{"query":"laptop"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    })
    expect(out.stop_reason).toBe('tool_use')
    expect(out.content).toEqual([
      { type: 'tool_use', id: 'call-1', name: 'search_products', input: { query: 'laptop' } },
    ])
  })

  it('tolerates malformed tool arguments', () => {
    const out = fromDeepSeekResponse({
      choices: [
        {
          message: {
            content: 'chào',
            tool_calls: [{ id: 'c1', function: { name: 'x', arguments: 'not-json' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    })
    expect(out.content[0]).toEqual({ type: 'text', text: 'chào' })
    expect(out.content[1]).toEqual({ type: 'tool_use', id: 'c1', name: 'x', input: {} })
  })

  it('blocks reasoning models that break tool-calling', () => {
    expect(isUnsupportedReasonerModel('deepseek-reasoner')).toBe(true)
    expect(isUnsupportedReasonerModel('deepseek/deepseek-r1:free')).toBe(true)
    expect(isUnsupportedReasonerModel('deepseek-chat')).toBe(false)
    expect(isUnsupportedReasonerModel('anthropic/claude-haiku-4-5')).toBe(false)
    expect(isUnsupportedReasonerModel('claude-haiku-4-5')).toBe(false)
  })

  it('parses GLM pseudo-XML tool calls out of text (no markup leak to UI)', () => {
    _resetGlmTextSeqForTests()
    const { text, calls } = extractGlmToolCalls(
      '<tool_call>search_products<arg_key>max_price</arg_key><arg_value>25000000</arg_value><arg_key>query</arg_key><arg_value>máy tính laptop văn phòng học tập</arg_value></tool_call>',
    )
    expect(text).toBe('')
    expect(calls).toEqual([
      {
        id: 'glm-text-0',
        name: 'search_products',
        input: { max_price: 25000000, query: 'máy tính laptop văn phòng học tập' },
      },
    ])
  })

  it('keeps surrounding prose and surfaces text tool calls as real tool_use', () => {
    _resetGlmTextSeqForTests()
    const out = fromDeepSeekResponse({
      choices: [
        {
          message: {
            content:
              'Để mình tìm giúp bạn nhé. <tool_call>search_products<arg_key>query</arg_key><arg_value>laptop</arg_value></tool_call>',
          },
          finish_reason: 'stop',
        },
      ],
    })
    expect(out.content[0]).toEqual({ type: 'text', text: 'Để mình tìm giúp bạn nhé.' })
    expect(out.content[1]).toEqual({
      type: 'tool_use',
      id: 'glm-text-0',
      name: 'search_products',
      input: { query: 'laptop' },
    })
  })

  it('retries retryable statuses then succeeds', async () => {
    const ok = { ok: true, status: 200 } as Response
    const fail = { ok: false, status: 503 } as Response
    const fetchMock = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok)
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await fetchWithRetry('https://example.test', {}, 3)
      expect(res).toBe(ok)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not retry client errors', async () => {
    const bad = { ok: false, status: 400 } as Response
    const fetchMock = vi.fn<(...args: unknown[]) => Promise<Response>>().mockResolvedValue(bad)
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await fetchWithRetry('https://example.test', {}, 3)
      expect(res).toBe(bad)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('disables hidden reasoning only when ASSISTANT_REASONING=0', () => {
    const saved = process.env.ASSISTANT_REASONING
    delete process.env.ASSISTANT_REASONING
    expect(toDeepSeekRequest(baseParams)).not.toHaveProperty('reasoning')
    process.env.ASSISTANT_REASONING = '0'
    expect(toDeepSeekRequest(baseParams)).toMatchObject({ reasoning: { enabled: false } })
    if (saved === undefined) delete process.env.ASSISTANT_REASONING
    else process.env.ASSISTANT_REASONING = saved
  })
})
