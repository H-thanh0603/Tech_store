import { describe, expect, it, vi } from 'vitest'

import type { MessagesClient } from '@/lib/assistant/agent'
import { feedDeepSeekDelta } from '@/lib/assistant/providers'
import { streamTurn } from '@/lib/assistant/stream'

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const encode = new TextEncoder()
  const chunks = frames.map((f) => encode.encode(`data: ${f}\n\n`))
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c)
      controller.close()
    },
  })
}

describe('assistant streaming', () => {
  it('reassembles fragmented DeepSeek tool calls', () => {
    const pending: { id: string; name: string; args: string }[] = []
    const d1 = feedDeepSeekDelta(pending, {
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'search_pro' } }] } }],
    })
    expect(d1).toEqual([])
    const d2 = feedDeepSeekDelta(pending, {
      choices: [
        {
          delta: {
            content: 'tìm ',
            tool_calls: [{ index: 0, function: { name: 'ducts', arguments: '{"query":' } }],
          },
        },
      ],
    })
    expect(d2).toEqual(['tìm '])
    feedDeepSeekDelta(pending, {
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] } }],
    })
    expect(pending[0]).toEqual({ id: 'c1', name: 'search_products', args: '{"query":"x"}' })
  })

  it('streams DeepSeek SSE text then tool_use blocks', async () => {
    const frames = [
      '{"choices":[{"delta":{"content":"Chào "}}]}',
      '{"choices":[{"delta":{"content":"bạn","tool_calls":[{"index":0,"id":"c1","function":{"name":"search_products","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}',
      '[DONE]',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, body: sseBody(frames) }) as Response),
    )
    try {
      const { createProviderClient } = await import('@/lib/assistant/providers')
      process.env.ASSISTANT_PROVIDER = 'deepseek'
      process.env.DEEPSEEK_API_KEY = 'test-key'
      const client = createProviderClient()
      expect(client?.messages.stream).toBeDefined()
      const events = []
      for await (const e of client!.messages.stream!({
        model: 'deepseek-chat',
        max_tokens: 10,
        system: 's',
        tools: [],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        events.push(e)
      }
      expect(events[0]).toEqual({ type: 'text_delta', text: 'Chào ' })
      expect(events[1]).toEqual({ type: 'text_delta', text: 'bạn' })
      const last = events[events.length - 1]
      expect(last.type).toBe('message')
      if (last.type === 'message') {
        expect(last.stop_reason).toBe('tool_use')
        expect(last.content).toHaveLength(2)
      }
    } finally {
      vi.unstubAllGlobals()
      delete process.env.ASSISTANT_PROVIDER
      delete process.env.DEEPSEEK_API_KEY
    }
  })

  it('yields deltas then a result through the shared loop', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () => ({ content: [], stop_reason: 'end_turn' }),
        stream: async function* () {
          yield { type: 'text_delta', text: 'Xin ' }
          yield { type: 'text_delta', text: 'chào.' }
          yield { type: 'message', content: [], stop_reason: 'end_turn' }
        },
      },
    }
    const seen: string[] = []
    const gen = streamTurn(client, {
      model: 'm',
      maxTokens: 10,
      maxIterations: 2,
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: 'hi' }],
      forcedTool: null,
      dispatch: async () => '',
      shouldEnd: () => false,
      fallbackReply: 'fallback',
      finish: (reply) => ({ reply }),
    })
    for await (const event of gen) {
      if (event.type === 'text') seen.push(event.delta)
      else expect(event.result).toEqual({ reply: 'Xin chào.' })
    }
    expect(seen).toEqual(['Xin ', 'chào.'])
  })

  it('falls back to create() when the provider has no stream', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: 'Trả lời gọn.' }],
          stop_reason: 'end_turn',
        }),
      },
    }
    const deltas: string[] = []
    const gen = streamTurn(client, {
      model: 'm',
      maxTokens: 10,
      maxIterations: 2,
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: 'hi' }],
      forcedTool: null,
      dispatch: async () => '',
      shouldEnd: () => false,
      fallbackReply: 'fallback',
      finish: (reply) => ({ reply }),
    })
    for await (const event of gen) {
      if (event.type === 'text') deltas.push(event.delta)
      else expect(event.result).toEqual({ reply: 'Trả lời gọn.' })
    }
    expect(deltas).toEqual(['Trả lời gọn.'])
  })
})
