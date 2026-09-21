import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  applyRankOrder,
  isJevEnabled,
  jevApi,
  jevDecide,
  jevEvaluateUrl,
  jevMaxTokens,
  jevRankIndices,
  jevUrl,
  parseEvaluateDecision,
  parseJevDecision,
  parseRankIndices,
  resolveMerchantScope,
  resolveShoppingScope,
} from '@/lib/assistant/jev'

const CHOICES = ['in-scope', 'gray', 'off-topic'] as const

function jsonFetch(content: string, ok = true) {
  const body = JSON.stringify({ choices: [{ message: { content } }] })
  return vi.fn(
    async () =>
      ({
        ok,
        status: ok ? 200 : 500,
        json: async () => JSON.parse(body),
        text: async () => body,
      }) as unknown as Response,
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('jev decision layer', () => {
  it('stays disabled without any key (fail-open)', async () => {
    vi.stubEnv('JEV_ENABLED', '')
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    expect(isJevEnabled()).toBe(false)
    expect(await jevDecide({ question: 'q?', choices: CHOICES, context: 'hi' })).toBeNull()
    expect(await jevRankIndices('laptop', [{ product_id: 'a', name: 'A' }])).toBeNull()
  })

  it('parses typed JSON decisions and rejects unknown choices', () => {
    expect(parseJevDecision('{"choice":"off-topic","confidence":0.92}', CHOICES)).toMatchObject({
      choice: 'off-topic',
      confidence: 0.92,
    })
    expect(parseJevDecision('```json\n{"choice":"gray","confidence":0.6}\n```', CHOICES)?.choice).toBe('gray')
    expect(parseJevDecision('{"choice":"refund","confidence":0.9}', CHOICES)).toBeNull()
    expect(parseJevDecision('no json here', CHOICES)).toBeNull()
  })

  it('keeps keyword in-scope without spending a Jev call', async () => {
    const fetchFn = jsonFetch('{"choice":"off-topic","confidence":0.99}')
    const out = await resolveShoppingScope('laptop học tập dưới 20 triệu', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out.verdict).toBe('in-scope')
    expect(out.source).toBe('keyword')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('lets a confident Jev rescue gray into off-topic', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = jsonFetch('{"choice":"off-topic","confidence":0.95}')
    const out = await resolveShoppingScope('dự báo thời tiết ngày mai thế nào', {
      fetchFn: fetchFn as unknown as typeof fetch,
      check: () => 'gray',
    })
    expect(out).toMatchObject({ verdict: 'off-topic', source: 'keyword+jev' })
  })

  it('ignores low-confidence Jev and keeps the keyword verdict', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_THRESHOLD', '0.7')
    const fetchFn = jsonFetch('{"choice":"off-topic","confidence":0.4}')
    const out = await resolveShoppingScope('cái thứ 2 thì sao', {
      fetchFn: fetchFn as unknown as typeof fetch,
      check: () => 'gray',
    })
    expect(out).toMatchObject({ verdict: 'gray', source: 'keyword' })
  })

  it('fails open when the Jev endpoint errors', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = jsonFetch('boom', false)
    const out = await resolveMerchantScope('doanh thu 7 ngày qua?', {
      fetchFn: fetchFn as unknown as typeof fetch,
      check: () => 'gray',
    })
    expect(out).toMatchObject({ verdict: 'gray', source: 'keyword' })
  })

  it('parses rank indices and applies order without dropping items', () => {
    expect(parseRankIndices('{"order":[2,0,1]}', 3)).toEqual([2, 0, 1])
    expect(parseRankIndices('nothing here', 3)).toBeNull()
    expect(parseRankIndices('[9,9]', 3)).toBeNull()
    expect(applyRankOrder(['a', 'b', 'c'], [2, 0])).toEqual(['c', 'a', 'b'])
    expect(applyRankOrder(['a', 'b'], null)).toEqual(['a', 'b'])
  })

  it('budgets enough tokens for reasoning stand-ins, clamped by JEV_MAX_TOKENS', () => {
    vi.stubEnv('JEV_MAX_TOKENS', '')
    expect(jevMaxTokens()).toBe(512)
    vi.stubEnv('JEV_MAX_TOKENS', '256')
    expect(jevMaxTokens()).toBe(256)
    vi.stubEnv('JEV_MAX_TOKENS', '99999')
    expect(jevMaxTokens()).toBe(512)
    vi.stubEnv('JEV_MAX_TOKENS', '12')
    expect(jevMaxTokens()).toBe(512)
  })

  it('resolves the gateway URL from JEV_BASE_URL with or without the path suffix', () => {
    vi.stubEnv('JEV_BASE_URL', 'http://localhost:20128/v1')
    expect(jevUrl()).toBe('http://localhost:20128/v1/chat/completions')
    vi.stubEnv('JEV_BASE_URL', 'http://localhost:20128/v1/chat/completions')
    expect(jevUrl()).toBe('http://localhost:20128/v1/chat/completions')
    vi.stubEnv('JEV_BASE_URL', '')
    expect(jevUrl()).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('parses 9router-style bodies with SSE trailers appended', async () => {
    const { parseOpenAICompatibleBody, fromDeepSeekResponse } = await import('@/lib/assistant/providers')
    const body =
      '{"choices":[{"message":{"content":"{\\"choice\\":\\"gray\\",\\"confidence\\":0.6}","tool_calls":[]},"finish_reason":"stop"}]}' +
      '\ndata: [DONE]\n\ndata: [DONE]\n'
    const out = fromDeepSeekResponse(parseOpenAICompatibleBody(body))
    expect(out.content[0]).toEqual({ type: 'text', text: '{"choice":"gray","confidence":0.6}' })
  })

  it('parses 9router-style bodies with the trailer glued to the JSON', async () => {
    const { parseOpenAICompatibleBody, fromDeepSeekResponse } = await import('@/lib/assistant/providers')
    const body =
      '{"choices":[{"message":{"content":"hi","tool_calls":[]},"finish_reason":"stop"}]}data: [DONE]\n\n'
    const out = fromDeepSeekResponse(parseOpenAICompatibleBody(body))
    expect(out.content[0]).toEqual({ type: 'text', text: 'hi' })
  })

  it('returns null rank on HTTP failure (keeps DB order)', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = jsonFetch('boom', false)
    const out = await jevRankIndices(
      'laptop',
      [
        { product_id: 'a', name: 'A' },
        { product_id: 'b', name: 'B' },
      ],
      fetchFn as unknown as typeof fetch,
    )
    expect(out).toBeNull()
  })

  it('auto-selects the evaluate transport for Vercel AI Gateway', () => {
    vi.stubEnv('JEV_MODEL', 'typesafe-ai/jev')
    vi.stubEnv('JEV_BASE_URL', 'https://ai-gateway.vercel.sh/v1')
    expect(jevApi()).toBe('evaluate')
    expect(jevEvaluateUrl()).toBe('https://ai-gateway.vercel.sh/v1/evaluate')
    vi.stubEnv('JEV_MODEL', 'openrouter/nex-agi/nex-n2.5-pro:free')
    vi.stubEnv('JEV_BASE_URL', 'http://localhost:20128/v1')
    expect(jevApi()).toBe('chat')
    vi.stubEnv('JEV_API', 'evaluate')
    expect(jevApi()).toBe('evaluate')
  })

  it('parses evaluate choice answers and rejects unknown choices', () => {
    expect(
      parseEvaluateDecision(
        { decision: { type: 'choice', choice: 'off-topic', probabilities: { 'off-topic': 0.97 } } },
        CHOICES,
      ),
    ).toMatchObject({ choice: 'off-topic', confidence: 0.97 })
    expect(
      parseEvaluateDecision({ decision: { type: 'choice', choice: 'refund', probabilities: {} } }, CHOICES),
    ).toBeNull()
    expect(parseEvaluateDecision({}, CHOICES)).toBeNull()
    expect(parseEvaluateDecision(undefined, CHOICES)).toBeNull()
  })

  it('decides via /v1/evaluate when the Jev model is typesafe-ai', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_BASE_URL', 'https://ai-gateway.vercel.sh/v1')
    vi.stubEnv('JEV_MODEL', 'typesafe-ai/jev')
    const seen: string[] = []
    const fetchFn = vi.fn(async (url: string) => {
      seen.push(url)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answers: { decision: { type: 'choice', choice: 'gray', probabilities: { gray: 0.88 } } },
        }),
      } as unknown as Response
    })
    const out = await jevDecide({
      question: 'q?',
      choices: CHOICES,
      context: 'hi',
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(seen[0]).toContain('/v1/evaluate')
    expect(out).toMatchObject({ choice: 'gray', confidence: 0.88 })
  })

  it('ranks via parallel score questions on the evaluate transport', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_BASE_URL', 'https://ai-gateway.vercel.sh/v1')
    vi.stubEnv('JEV_MODEL', 'typesafe-ai/jev')
    const bodies: { questions: Record<string, unknown> }[] = []
    const fetchFn = vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answers: { rel_0: { score: 0.5 }, rel_1: { score: 2.9 }, rel_2: { score: 1.2 } },
        }),
      } as unknown as Response
    })
    const out = await jevRankIndices(
      'laptop học tập',
      [
        { product_id: 'a', name: 'A' },
        { product_id: 'b', name: 'B' },
        { product_id: 'c', name: 'C' },
      ],
      fetchFn as unknown as typeof fetch,
    )
    expect(Object.keys(bodies[0].questions)).toEqual(['rel_0', 'rel_1', 'rel_2'])
    expect(out).toEqual([1, 2, 0])
  })
})
