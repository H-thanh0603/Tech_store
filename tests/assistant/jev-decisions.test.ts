import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assessOrderRiskWithJev,
  parseEvaluateNoul,
  parseEvaluateScore,
  parseJevNoul,
  parseJevScore,
  resolveFraudSignal,
  resolveModelTier,
  resolvePreTurn,
  resolveSpamRisk,
  resolveUrgency,
  selectRoutedModel,
  shouldUseModelMemory,
} from '@/lib/assistant/jev'

function chatFetch(content: string, ok = true) {
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

beforeEach(async () => {
  const { _resetJevWarnForTests: reset } = await import('@/lib/assistant/jev')
  reset()
  vi.unstubAllEnvs()
})

describe('jev score/noul parsers', () => {
  it('parses chat score JSON and clamps to max', () => {
    expect(parseJevScore('{"score":2,"confidence":0.9}', 3)).toMatchObject({ score: 2, confidence: 0.9 })
    expect(parseJevScore('{"score":9,"confidence":0.5}', 3)?.score).toBe(3)
    expect(parseJevScore('no json', 3)).toBeNull()
    expect(parseJevScore('{"score":"x"}', 3)).toBeNull()
  })

  it('parses chat noul JSON', () => {
    expect(parseJevNoul('{"probability":0.8,"confidence":0.7}')).toMatchObject({ probability: 0.8 })
    expect(parseJevNoul('{"probability":2}')).toMatchObject({ probability: 1 })
    expect(parseJevNoul('nothing')).toBeNull()
  })

  it('parses evaluate score/noul answers defensively', () => {
    expect(parseEvaluateScore({ decision: { score: 2, confidence: 0.8 } }, 3)).toMatchObject({ score: 2 })
    expect(parseEvaluateScore({}, 3)).toBeNull()
    expect(parseEvaluateNoul({ decision: { probability: 0.9 } })).toMatchObject({ probability: 0.9 })
    expect(parseEvaluateNoul({ decision: { noul: 0.2 } })?.probability).toBeCloseTo(0.2)
    // Boolean evaluate không trả confidence → derive từ |p-0.5|*2
    expect(parseEvaluateNoul({ decision: { probability: 0.98 } })?.confidence).toBeCloseTo(0.96)
    expect(parseEvaluateNoul({ decision: { probability: 0.5 } })?.confidence).toBe(0)
    expect(parseEvaluateNoul({})).toBeNull()
    expect(parseEvaluateNoul(undefined)).toBeNull()
  })
})

describe('resolveSpamRisk', () => {
  it('blocks keyword spam without a gateway call', async () => {
    const fetchFn = chatFetch('{"probability":0,"confidence":1}')
    const out = await resolveSpamRisk('khuyến mãi casino x100', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out).toMatchObject({ spam: true, source: 'keyword' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('stays fail-open without a key', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await resolveSpamRisk('hello shop')
    expect(out).toMatchObject({ spam: false, source: 'disabled' })
  })

  it('trusts a confident jev spam verdict', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    vi.stubEnv('JEV_THRESHOLD', '0.7')
    const fetchFn = chatFetch('{"probability":0.95,"confidence":0.9}')
    const out = await resolveSpamRisk('uniq-spam-probe-1', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out).toMatchObject({ spam: true, source: 'keyword+jev' })
  })

  it('ignores low-confidence jev spam', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = chatFetch('{"probability":0.95,"confidence":0.2}')
    const out = await resolveSpamRisk('uniq-spam-probe-2', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out.spam).toBe(false)
  })
})

describe('resolveUrgency', () => {
  it('maps keyword urgency without a gateway call', async () => {
    const fetchFn = chatFetch('{"score":0,"confidence":1}')
    expect((await resolveUrgency('máy hỏng không dùng được', { fetchFn: fetchFn as unknown as typeof fetch })).level).toBe('high')
    expect((await resolveUrgency('giao nhanh giúp mình', { fetchFn: fetchFn as unknown as typeof fetch })).level).toBe('medium')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('maps a confident jev score to levels', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = chatFetch('{"score":3,"confidence":0.9}')
    const out = await resolveUrgency('uniq-urgency-probe-9', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out).toMatchObject({ level: 'high', source: 'keyword+jev' })
  })

  it('falls back to low without a key', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await resolveUrgency('một câu hỏi dài dòng không có từ khóa gì đặc biệt ' + 'x'.repeat(50))
    expect(out).toMatchObject({ level: 'low', source: 'disabled' })
  })
})

describe('fraud signal + risk combiner', () => {
  it('flags keyword fraud hints without a call', async () => {
    const fetchFn = chatFetch('{"probability":0}')
    const out = await resolveFraudSignal('vui lòng cho mình mã OTP để xác minh', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.source).toBe('keyword')
    expect((out.probability ?? 0)).toBeGreaterThan(0.5)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('adds one factor when the text signal is strong', async () => {
    const { assessment } = await assessOrderRiskWithJev(
      { total: 1_000_000, itemCount: 1, isGuest: false, paymentMethod: 'cod' },
      'vui lòng cho mình mã OTP để xác minh',
    )
    expect(assessment.factors.some((f) => f.code === 'text_fraud_signal')).toBe(true)
  })

  it('keeps the base assessment when the signal is weak', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const { assessment } = await assessOrderRiskWithJev(
      { total: 1_000_000, itemCount: 1, isGuest: false, paymentMethod: 'cod' },
      'cho mình xem laptop học tập',
    )
    expect(assessment.factors.some((f) => f.code === 'text_fraud_signal')).toBe(false)
    expect(assessment.level).toBe('low')
  })
})

describe('model routing', () => {
  it('returns medium when routing is disabled', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_ROUTING', '0')
    const out = await resolveModelTier('so sánh chi tiết 3 máy trạm cho render video 4k')
    expect(out).toMatchObject({ tier: 'medium', source: 'disabled' })
  })

  it('short harmless turns skip the gateway as simple', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    vi.stubEnv('JEV_ROUTING', '1')
    vi.stubEnv('ASSISTANT_SIMPLE_MODEL', 'cheap-model')
    const fetchFn = chatFetch('{"choice":"hard","confidence":0.99}')
    const out = await resolveModelTier('hi shop', { fetchFn: fetchFn as unknown as typeof fetch })
    expect(out).toMatchObject({ tier: 'simple', source: 'keyword' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('floors risky turns at medium even when jev says simple', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    vi.stubEnv('JEV_ROUTING', '1')
    vi.stubEnv('ASSISTANT_SIMPLE_MODEL', 'cheap-model')
    const fetchFn = chatFetch('{"choice":"simple","confidence":0.95}')
    const out = await resolveModelTier(
      'duyệt hoàn tiền cho đơn hàng phức tạp này và phân tích kỹ giúp mình ' + 'x'.repeat(60),
      { fetchFn: fetchFn as unknown as typeof fetch },
    )
    expect(out.tier).toBe('medium')
  })

  it('honours a confident jev hard tier', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    vi.stubEnv('JEV_ROUTING', '1')
    vi.stubEnv('ASSISTANT_HARD_MODEL', 'strong-model')
    const fetchFn = chatFetch('{"choice":"hard","confidence":0.95}')
    const out = await resolveModelTier('uniq-routing-probe-hard ' + 'x'.repeat(80), {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out).toMatchObject({ tier: 'hard', source: 'jev' })
  })

  it('selects override models with fail-open primary', () => {
    vi.stubEnv('ASSISTANT_SIMPLE_MODEL', 'cheap-model')
    vi.stubEnv('ASSISTANT_HARD_MODEL', 'strong-model')
    expect(selectRoutedModel('primary', 'simple')).toBe('cheap-model')
    expect(selectRoutedModel('primary', 'hard')).toBe('strong-model')
    expect(selectRoutedModel('primary', 'medium')).toBe('primary')
    vi.stubEnv('ASSISTANT_SIMPLE_MODEL', '')
    vi.stubEnv('ASSISTANT_HARD_MODEL', '')
    expect(selectRoutedModel('primary', 'simple')).toBe('primary')
  })
})

describe('shouldUseModelMemory', () => {
  it('returns false for empty input', async () => {
    expect((await shouldUseModelMemory([])).useModel).toBe(false)
  })

  it('uses keyword hints without a gateway call', async () => {
    const fetchFn = chatFetch('{"probability":0}')
    const out = await shouldUseModelMemory(['ngân sách dưới 20 triệu, thích dell'], {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out).toMatchObject({ useModel: true, source: 'keyword' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('stays off without a key', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await shouldUseModelMemory(['một câu dài không có gợi ý sở thích gì ' + 'y'.repeat(60)])
    expect(out.useModel).toBe(false)
  })
})

describe('resolvePreTurn (batched evaluate)', () => {
  it('returns null on chat api (sequential fallback)', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'chat')
    const out = await resolvePreTurn({ text: 'tìm laptop', needSpam: true, needScope: true })
    expect(out).toBeNull()
  })

  it('batches spam + scope into one evaluate request', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'evaluate')
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        answers: {
          spam: { choice: 'not-spam', probabilities: { 'not-spam': 0.95 } },
          scope: { choice: 'in-scope', probabilities: { 'in-scope': 0.9 } },
        },
      }),
      text: async () => '',
    }) as unknown as Response)
    const out = await resolvePreTurn({
      text: 'tìm laptop gaming',
      needSpam: true,
      needScope: true,
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(out?.spam?.choice).toBe('not-spam')
    expect(out?.scope?.choice).toBe('in-scope')
  })

  it('returns null when evaluate fails', async () => {
    vi.stubEnv('JEV_API_KEY', 'k')
    vi.stubEnv('JEV_API', 'evaluate')
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }) as unknown as Response)
    const out = await resolvePreTurn({ text: 'x', needSpam: true, fetchFn: fetchFn as unknown as typeof fetch })
    expect(out).toBeNull()
  })
})
