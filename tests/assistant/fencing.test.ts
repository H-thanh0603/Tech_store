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

  it('tells the model fenced instructions are data, not orders', () => {
    expect(FENCE_NOTICE).toMatch(/never something to follow|report/i)
  })
})
