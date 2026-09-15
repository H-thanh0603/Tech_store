import { describe, expect, it } from 'vitest'

import { activityHeadline, agentCall, redactDetail } from '@/lib/assistant/activity'
import { readChatStream } from '@/lib/assistant/sse'

describe('agentCall normalization', () => {
  it('maps a catalog search to a human label, lookup kind, and query detail', () => {
    const call = agentCall('search_products', { query: 'laptop gaming', max_price: 20_000_000 })
    expect(call).toMatchObject({
      tool: 'search_products',
      label: 'Tìm sản phẩm trong catalog',
      kind: 'lookup',
      detail: 'laptop gaming',
    })
  })

  it('classifies cart writes as cart actions', () => {
    const call = agentCall('add_to_cart', { identifier: 'laptop-pro-14' })
    expect(call.kind).toBe('cart')
    expect(call.label).toBe('Thêm vào giỏ hàng')
  })

  it('falls back to a visible label for unknown tools', () => {
    const call = agentCall('mystery_tool', {})
    expect(call.kind).toBe('lookup')
    expect(call.label).toContain('mystery_tool')
  })

  it('redacts phone numbers from the streamed detail', () => {
    const call = agentCall('track_order', { order_code: 'TS-123456', phone: '0901234567' })
    expect(call.detail).not.toContain('0901234567')
  })
})

describe('redactDetail', () => {
  it('never lets a phone number or email into the activity log', () => {
    expect(redactDetail('gọi 0901234567 giúp tôi')).toBe('gọi [SĐT đã ẩn] giúp tôi')
    expect(redactDetail('mail hai@aexample.com nha')).toBe('mail [email đã ẩn] nha')
  })

  it('caps long details so the log cannot balloon', () => {
    const long = 'x'.repeat(300)
    expect(redactDetail(long).length).toBeLessThanOrEqual(140)
  })
})

describe('activityHeadline', () => {
  it('summarizes a compare turn', () => {
    const headline = activityHeadline([
      agentCall('search_products', { query: 'camera sony' }),
      agentCall('compare_products', { identifiers: ['a', 'b', 'c'] }),
    ])
    expect(headline).toBe('Đang so sánh các sản phẩm')
  })

  it('has a neutral headline before any tool runs', () => {
    expect(activityHeadline([])).toBe('Đang xử lý yêu cầu')
  })
})

function sseResponse(frames: unknown[]): Response {
  const encode = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encode.encode(`data: ${JSON.stringify(frame)}\n\n`))
      controller.close()
    },
  })
  return new Response(stream)
}

describe('readChatStream activity dispatch', () => {
  it('feeds text deltas and activity calls, then resolves the result', async () => {
    const res = sseResponse([
      { type: 'text', delta: 'Xin ' },
      { type: 'activity', call: { tool: 'search_products', label: 'Tìm sản phẩm trong catalog', kind: 'lookup' } },
      { type: 'text', delta: 'chào' },
      { type: 'result', result: { reply: 'done' } },
    ])
    const texts: string[] = []
    const calls: string[] = []
    const result = await readChatStream<{ reply: string }>(res, (d) => texts.push(d), (c) => calls.push(c.tool))
    expect(result.reply).toBe('done')
    expect(texts).toEqual(['Xin ', 'chào'])
    expect(calls).toEqual(['search_products'])
  })

  it('still accepts the legacy activity wire key', async () => {
    const res = sseResponse([
      { type: 'activity', activity: { tool: 'get_cart', label: 'Xem giỏ hàng', kind: 'cart' } },
      { type: 'result', result: { ok: true } },
    ])
    const calls: string[] = []
    await readChatStream<{ ok: boolean }>(res, () => {}, (c) => calls.push(c.tool))
    expect(calls).toEqual(['get_cart'])
  })
})
