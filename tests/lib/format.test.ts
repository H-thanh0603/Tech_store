import { describe, expect, it } from 'vitest'

import { formatPrice } from '@/lib/format'

describe('formatPrice', () => {
  it('formats whole-dong values as VND currency', () => {
    // Non-breaking spaces and the đ suffix are locale output; assert on digits
    // and suffix rather than exact whitespace to stay robust across ICU builds.
    const result = formatPrice(27990000)
    expect(result).toContain('27')
    expect(result).toContain('990')
    expect(result).toContain('₫')
  })

  it('never emits fraction digits', () => {
    // vi-VN uses '.' as the thousands separator and ',' as the decimal mark, so
    // a fraction would show as ',00'. Assert no decimal mark is present.
    expect(formatPrice(4490000)).not.toContain(',00')
    expect(formatPrice(4499999)).not.toContain(',')
  })

  it('clamps negative and non-finite input to zero', () => {
    expect(formatPrice(-500)).toBe(formatPrice(0))
    expect(formatPrice(Number.NaN)).toBe(formatPrice(0))
  })
})
