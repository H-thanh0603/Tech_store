import { describe, expect, it, vi } from 'vitest'

/**
 * Q25 — session/cart cookie flags. HttpOnly + SameSite=Lax are asserted on
 * every set; Secure is environment-gated (true in production).
 */

const setCookie = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: setCookie }),
}))

import { CART_COOKIE, getOrCreateCartToken } from '@/lib/commerce/cookies'

describe('cookie flags', () => {
  it('sets HttpOnly + SameSite=Lax + path on the cart cookie', async () => {
    await getOrCreateCartToken()

    expect(setCookie).toHaveBeenCalledWith(
      CART_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    )
  })

  it('mints an opaque 43-char token (never a guessable id)', async () => {
    const token = await getOrCreateCartToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})
