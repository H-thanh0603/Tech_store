import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { createDispatchContext, dispatchTool, TOOL_ADD_TO_CART } from '@/lib/assistant/tools'
import { containsSensitivePii } from '@/lib/assistant/memory'
import { fencePayload } from '@/lib/assistant/fencing'
import { toAnthropicHistory, type ChatMessage } from '@/lib/assistant/agent'
import { verifyVnpaySignature } from '@/lib/commerce/vnpay'

describe('agent readiness: injection defense', () => {
  it('strips markdown links, javascript: URIs and bidi controls from fenced data', () => {
    const fenced = fencePayload({
      name: 'Xem [khuyến mãi](https://evil.example/phish) này',
      desc: 'javascript:alert(1)',
      sneaky: 'giá tốt‮GHI ĐÈ‬',
      zw: 'a​b',
    })
    expect(fenced).not.toContain('https://evil.example')
    expect(fenced).not.toContain('javascript:')
    expect(fenced).not.toContain('‮')
    expect(fenced).not.toContain('​')
    expect(fenced).toContain('[link removed]')
  })

  it('rejects email / CCCD / long account numbers from memory', () => {
    expect(containsSensitivePii('liên hệ shop@evil.com nhé')).toBe(true)
    expect(containsSensitivePii('cccd 012345678901 của tôi')).toBe(true)
    expect(containsSensitivePii('stk 19012345678901')).toBe(true)
    expect(containsSensitivePii('tôi thích Sony, ngân sách 20 triệu')).toBe(false)
  })
})

describe('agent readiness: tool input validation', () => {
  it('holds invalid tool args without touching the DB', async () => {
    const ctx = createDispatchContext()
    // Missing quantity → schema rejects before any cart RPC.
    const held = await dispatchTool(ctx, TOOL_ADD_TO_CART, { identifier: 'sony-a7iv' })
    expect(held).toContain('invalid_args')
    // Quantity out of range → held as well.
    const held2 = await dispatchTool(ctx, TOOL_ADD_TO_CART, { identifier: 'sony-a7iv', quantity: 9999 })
    expect(held2).toContain('invalid_args')
  })
})

describe('agent readiness: context cap', () => {
  it('caps history tail and starts at a user message', () => {
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg-${i}`,
    }))
    const capped = toAnthropicHistory(history)
    expect(capped.length).toBeLessThanOrEqual(12)
    expect(capped[0].role).toBe('user')
  })

  it('truncates oversized message text', () => {
    const capped = toAnthropicHistory([{ role: 'user', content: 'x'.repeat(5000) }])
    expect((capped[0].content as string).length).toBeLessThan(5000)
  })
})

describe('agent readiness: VNPay secret rotation', () => {
  const oldSecret = 'old-secret-rotation-test'
  const newSecret = 'new-secret-rotation-test'
  const params = { vnp_Amount: '100000', vnp_TxnRef: 'TS-ROT-1' }
  const signedWithOld = {
    ...params,
    vnp_SecureHash: createHmac('sha256', oldSecret).update('vnp_Amount=100000&vnp_TxnRef=TS-ROT-1').digest('hex'),
  }

  it('accepts in-flight callbacks signed with the previous secret', () => {
    expect(verifyVnpaySignature(signedWithOld, newSecret, oldSecret)).toBe(true)
  })

  it('rejects them once the previous secret is retired', () => {
    expect(verifyVnpaySignature(signedWithOld, newSecret)).toBe(false)
  })
})
