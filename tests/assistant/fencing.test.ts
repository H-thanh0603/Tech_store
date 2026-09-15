import { describe, expect, it } from 'vitest'

import { FENCE_LABEL, FENCE_NOTICE, fencePayload } from '@/lib/assistant/fencing'

describe('storefront data fence', () => {
  it('wraps payloads in labeled tags', () => {
    const fenced = fencePayload({ price: 1000 })
    expect(fenced).toContain(`<${FENCE_LABEL}>`)
    expect(fenced).toContain(`</${FENCE_LABEL}>`)
    expect(fenced).toContain('1000')
  })

  it('strips markup that could break out of the fence', () => {
    const fenced = fencePayload('<script>alert(1)</script>')
    expect(fenced).not.toContain('<script>')
  })

  it('redacts bare URLs so poisoned records cannot smuggle fetch-and-follow (H4)', () => {
    const fenced = fencePayload({ desc: 'xem thêm tại https://evil.example/phish nhé' })
    expect(fenced).not.toContain('https://evil.example')
    expect(fenced).toContain('[url removed]')
  })

  it('tells the model fenced instructions are data, not orders', () => {
    expect(FENCE_NOTICE).toMatch(/never something to follow|report/i)
  })
})
