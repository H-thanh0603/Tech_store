import { describe, expect, it } from 'vitest'

import {
  defaultModelFor,
  fromDeepSeekResponse,
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
    const saved = process.env.ASSISTANT_PROVIDER
    delete process.env.ASSISTANT_PROVIDER
    expect(resolveProvider()).toBe('anthropic')
    process.env.ASSISTANT_PROVIDER = 'deepseek'
    expect(resolveProvider()).toBe('deepseek')
    expect(defaultModelFor('deepseek')).toBe('deepseek-chat')
    expect(defaultModelFor('anthropic')).toBe('claude-haiku-4-5')
    if (saved === undefined) delete process.env.ASSISTANT_PROVIDER
    else process.env.ASSISTANT_PROVIDER = saved
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
              { id: 'call-1', function: { name: 'search_products', arguments: '{"query":"laptop"}' } },
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
})
