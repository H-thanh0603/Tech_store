import { describe, expect, it } from 'vitest'

import { createOpaqueToken, hashToken, isTokenPepperConfigured, sha256Hex } from '@/lib/commerce/tokens'

describe('createOpaqueToken', () => {
  it('creates a URL-safe token with at least 32 random bytes', () => {
    const token = createOpaqueToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    // 32 bytes base64url-encoded, unpadded, is 43 chars.
    expect(token.length).toBeGreaterThanOrEqual(43)
  })

  it('produces a different token on each call', () => {
    expect(createOpaqueToken()).not.toBe(createOpaqueToken())
  })
})

describe('sha256Hex', () => {
  it('hashes the same token deterministically', async () => {
    expect(await sha256Hex('token')).toBe(await sha256Hex('token'))
    expect(await sha256Hex('token')).not.toBe(await sha256Hex('other'))
  })

  it('returns a 64-char lowercase hex digest', async () => {
    expect(await sha256Hex('token')).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('hashToken (pepper)', () => {
  it('falls back to sha256 without pepper', async () => {
    const prev = process.env.TOKEN_PEPPER
    delete process.env.TOKEN_PEPPER
    try {
      expect(await hashToken('token')).toBe(await sha256Hex('token'))
      expect(isTokenPepperConfigured()).toBe(false)
    } finally {
      if (prev !== undefined) process.env.TOKEN_PEPPER = prev
    }
  })

  it('uses HMAC when pepper is set and differs from plain sha256', async () => {
    const prev = process.env.TOKEN_PEPPER
    process.env.TOKEN_PEPPER = 'test-pepper-0123456789abcdef-32chars!!'
    try {
      const h = await hashToken('token')
      expect(h).toMatch(/^[a-f0-9]{64}$/)
      expect(h).not.toBe(await sha256Hex('token'))
      expect(await hashToken('token')).toBe(h)
      expect(isTokenPepperConfigured()).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.TOKEN_PEPPER
      else process.env.TOKEN_PEPPER = prev
    }
  })
})
