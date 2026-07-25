import { describe, expect, it } from 'vitest'

import { createAdminSessionToken, verifyAdminSessionToken } from '@/lib/admin/auth'

/**
 * Middleware uses the same token format as Node auth helpers.
 * This test locks the contract so Edge verification stays compatible.
 */
describe('admin session token contract for middleware', () => {
  it('produces a three-part token that Node verify accepts', () => {
    process.env.ADMIN_SECRET = 'test-admin-secret-32chars-long!!'
    const token = createAdminSessionToken()
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toMatch(/^\d+$/)
    expect(verifyAdminSessionToken(token)).toBe(true)
  })
})
