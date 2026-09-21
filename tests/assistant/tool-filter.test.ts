import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  keywordMerchantBuckets,
  keywordToolBuckets,
  merchantFilterSummary,
  resolveMerchantTools,
  resolveShoppingTools,
  shoppingFilterSummary,
  type ShoppingToolBucket,
} from '@/lib/assistant/tool-filter'
import { buildMerchantTools } from '@/lib/assistant/merchant/tools'
import { buildAnthropicTools } from '@/lib/assistant/tools'

function names(result: { tools: { name: string }[] }): string[] {
  return result.tools.map((t) => t.name)
}

function jsonFetch(content: string, ok = true) {
  const body = JSON.stringify({ choices: [{ message: { content } }] })
  return vi.fn(
    async () =>
      ({
        ok,
        status: ok ? 200 : 500,
        text: async () => body,
      }) as unknown as Response,
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('shopping tool filter', () => {
  it('maps clear intents to buckets without any network', () => {
    expect(keywordToolBuckets('laptop học tập dưới 20 triệu')).toEqual(['catalog'])
    expect(keywordToolBuckets('Chính sách đổi trả thế nào?')).toEqual(['policy'])
    expect(keywordToolBuckets('Đơn TS-ABC123 tới đâu rồi, SĐT 0901234567')).toEqual(['order'])
    expect(keywordToolBuckets('giỏ hàng của tôi có gì')).toEqual(['cart'])
    expect(keywordToolBuckets('phí ship bao nhiêu')).toEqual(['policy', 'fulfillment'])
    expect(keywordToolBuckets('cái thứ 2 thì sao')).toEqual([])
  })

  it('shrinks the schema for clear intents (no JEV key needed)', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await resolveShoppingTools('tìm laptop dưới 20 triệu')
    expect(out.source).toBe('keyword')
    expect(out.buckets).toEqual(['catalog'])
    const n = names(out)
    expect(n).toContain('search_products')
    expect(n).toContain('present_suggestions')
    expect(n).not.toContain('track_order')
    expect(n).not.toContain('search_policies')
    expect(out.tools.length).toBeLessThan(buildAnthropicTools().length)
  })

  it('keeps forced-gate tools available for mixed intents', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await resolveShoppingTools('Chính sách đổi trả thế nào?')
    expect(names(out)).toContain('search_policies')
  })

  it('lets JEV pick a bucket for gray messages', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_TOOL_FILTER', '1')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = jsonFetch('{"choice":"order","confidence":0.95}')
    const out = await resolveShoppingTools('cái thứ 2 thì sao', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.source).toBe('jev')
    expect(out.buckets).toEqual(['order'] as ShoppingToolBucket[])
    expect(fetchFn).toHaveBeenCalled()
    expect(names(out)).toContain('track_order')
  })

  it('fails open to full tools on low confidence or gateway error', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const full = buildAnthropicTools().length
    const low = await resolveShoppingTools('cái thứ 2 thì sao', {
      fetchFn: jsonFetch('{"choice":"order","confidence":0.4}') as unknown as typeof fetch,
    })
    expect(low.source).toBe('full')
    expect(low.tools).toHaveLength(full)
    const dead = await resolveShoppingTools('cái thứ 2 thì sao', {
      fetchFn: jsonFetch('boom', false) as unknown as typeof fetch,
    })
    expect(dead.source).toBe('full')
    expect(dead.tools).toHaveLength(full)
  })

  it('rolls back to full tools with JEV_TOOL_FILTER=0', async () => {
    vi.stubEnv('JEV_TOOL_FILTER', '0')
    const out = await resolveShoppingTools('tìm laptop')
    expect(out.source).toBe('full')
    expect(out.tools).toHaveLength(buildAnthropicTools().length)
  })

  it('inherits the previous turn buckets for gray follow-ups (no JEV call)', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    const fetchFn = jsonFetch('{"choice":"order","confidence":0.99}')
    const out = await resolveShoppingTools('cái thứ 2 thì sao', {
      prevTexts: ['tìm laptop dưới 20 triệu'],
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.source).toBe('history')
    expect(out.buckets).toEqual(['catalog'])
    expect(fetchFn).not.toHaveBeenCalled()
    expect(names(out)).toContain('search_products')
  })

  it('falls back to JEV when history has no signal', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const fetchFn = jsonFetch('{"choice":"order","confidence":0.95}')
    const out = await resolveShoppingTools('ừm', {
      prevTexts: ['ừ'],
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.source).toBe('jev')
    expect(fetchFn).toHaveBeenCalled()
  })

  it('maps merchant intents to buckets without any network', () => {
    expect(keywordMerchantBuckets('Doanh thu 7 ngày qua?')).toEqual(['metrics'])
    expect(keywordMerchantBuckets('Hàng nào sắp hết?')).toEqual(['metrics'])
    expect(keywordMerchantBuckets('Đơn nào đang chờ xử lý?')).toEqual(['inventory'])
    expect(keywordMerchantBuckets('giảm giá 10% cho laptop')).toEqual(['listing'])
    expect(keywordMerchantBuckets('soạn brief chiến dịch sale')).toEqual(['listing', 'campaign'])
    expect(keywordMerchantBuckets('ừm')).toEqual([])
  })

  it('shrinks the merchant schema for clear intents (no JEV key needed)', async () => {
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const out = await resolveMerchantTools('doanh thu tuần này thế nào')
    expect(out.source).toBe('keyword')
    const n = names(out)
    expect(n).toContain('get_business_snapshot')
    expect(n).toContain('present_suggestions')
    expect(n).not.toContain('stage_price_change')
    expect(n).not.toContain('draft_campaign_brief')
    expect(out.tools.length).toBeLessThan(buildMerchantTools().length)
  })

  it('inherits merchant buckets for gray follow-ups without network', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    const fetchFn = jsonFetch('{"choice":"campaign","confidence":0.99}')
    const out = await resolveMerchantTools('vậy còn tuần trước', {
      prevTexts: ['doanh thu tuần này thế nào'],
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.source).toBe('history')
    expect(out.buckets).toEqual(['metrics'])
    expect(fetchFn).not.toHaveBeenCalled()
    expect(names(out)).toContain('get_business_snapshot')
  })

  it('fails merchant open to full tools when JEV is unsure or dead', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const full = buildMerchantTools().length
    const low = await resolveMerchantTools('ừm', {
      prevTexts: ['ừ'],
      fetchFn: jsonFetch('{"choice":"metrics","confidence":0.2}') as unknown as typeof fetch,
    })
    expect(low.source).toBe('full')
    expect(low.tools).toHaveLength(full)
  })

  it('reports schema savings through the summary', async () => {
    const shopping = await resolveShoppingTools('tìm laptop')
    const summary = shoppingFilterSummary(shopping)
    expect(summary).toMatchObject({ source: 'keyword', full: buildAnthropicTools().length })
    expect(summary.sent).toBeLessThan(summary.full)
    const merchant = await resolveMerchantTools('doanh thu tuần này')
    const mSummary = merchantFilterSummary(merchant)
    expect(mSummary.sent).toBeLessThan(mSummary.full)
  })
})
