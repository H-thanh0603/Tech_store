import { describe, expect, it } from 'vitest'

import { trustedClientIp } from '@/lib/net/ip'

function headers(entries: Record<string, string>): Pick<Headers, 'get'> {
  const map = new Map(Object.entries(entries))
  return { get: (k: string) => map.get(k.toLowerCase()) ?? map.get(k) ?? null } as Pick<Headers, 'get'>
}

describe('trustedClientIp (H1)', () => {
  it('prefers x-real-ip over forwarded-for', () => {
    expect(
      trustedClientIp(headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('1.2.3.4')
  })

  it('uses the leftmost valid XFF entry, not the last hop', () => {
    expect(trustedClientIp(headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))).toBe(
      '1.1.1.1',
    )
  })

  it('skips leading garbage and collapses to unknown', () => {
    expect(trustedClientIp(headers({ 'x-forwarded-for': 'evil, 5.6.7.8' }))).toBe('5.6.7.8')
    expect(trustedClientIp(headers({ 'x-forwarded-for': 'evil-!!' }))).toBe('unknown')
    expect(trustedClientIp(headers({}))).toBe('unknown')
  })

  it('rotating the trailing XFF hop does not change identity', () => {
    const a = trustedClientIp(headers({ 'x-real-ip': '7.7.7.7', 'x-forwarded-for': '7.7.7.7, 9.9.9.9' }))
    const b = trustedClientIp(headers({ 'x-real-ip': '7.7.7.7', 'x-forwarded-for': '7.7.7.7, 8.8.8.8' }))
    expect(a).toBe(b)
  })
})
