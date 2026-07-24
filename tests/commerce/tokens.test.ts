import { describe, expect, it } from 'vitest'

import { createOpaqueToken, sha256Hex } from '@/lib/commerce/tokens'

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
