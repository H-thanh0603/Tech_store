import { describe, expect, it } from 'vitest'

import { getRateLimitIdentity } from '@/lib/commerce/request-identity'

describe('getRateLimitIdentity', () => {
  it('uses the proxy-owned address instead of a spoofable first XFF hop', () => {
    const headers = new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.9' })

    expect(getRateLimitIdentity(headers, 'session-hash')).toBe('session-hash:203.0.113.9')
  })
})
