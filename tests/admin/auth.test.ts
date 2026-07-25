import { afterEach, describe, expect, it } from 'vitest'

import {
  createAdminSessionToken,
  secretsMatch,
  verifyAdminSessionToken,
} from '@/lib/admin/auth'

const ORIGINAL = process.env.ADMIN_SECRET

afterEach(() => {
  process.env.ADMIN_SECRET = ORIGINAL
})

describe('admin auth tokens', () => {
  it('round-trips a signed session token', () => {
    process.env.ADMIN_SECRET = 'test-admin-secret-32chars-long!!'
    const token = createAdminSessionToken()
    expect(verifyAdminSessionToken(token)).toBe(true)
  })

  it('rejects tampered tokens', () => {
    process.env.ADMIN_SECRET = 'test-admin-secret-32chars-long!!'
    const token = createAdminSessionToken()
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa')
    expect(verifyAdminSessionToken(tampered)).toBe(false)
  })

  it('rejects expired tokens', () => {
    process.env.ADMIN_SECRET = 'test-admin-secret-32chars-long!!'
    const token = createAdminSessionToken(Date.now() - 20 * 60 * 60 * 1000)
    expect(verifyAdminSessionToken(token)).toBe(false)
  })

  it('compares secrets in constant-time style', () => {
    expect(secretsMatch('same-secret-value', 'same-secret-value')).toBe(true)
    expect(secretsMatch('same-secret-value', 'other-secret-value')).toBe(false)
  })
})
