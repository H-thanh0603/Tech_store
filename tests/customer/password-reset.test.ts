import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Q23 — password reset: anti-enumeration, token-1-lần qua Supabase recovery
 * link, đổi xong thu hồi toàn bộ session (Q26).
 */

const resetPasswordForEmail = vi.fn(async () => ({ error: null }))
const updateUser = vi.fn(async () => ({ error: null }))
const getSession = vi.fn(async () => ({ data: { session: null } }))
const localSignOut = vi.fn(async () => ({}))
const globalSignOut = vi.fn(async () => ({}))
const rateLimitRpc = vi.fn(async () => ({ data: false, error: null }))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/net/ip', () => ({ trustedClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/supabase/auth-server', () => ({
  createSupabaseAuthClient: async () => ({
    auth: {
      resetPasswordForEmail,
      updateUser,
      getSession,
      signOut: localSignOut,
    },
  }),
}))
vi.mock('@/lib/supabase/service-role', () => ({
  getSupabaseServiceRoleClient: () => ({
    rpc: rateLimitRpc,
    auth: { admin: { signOut: globalSignOut } },
  }),
}))

import { requestPasswordReset, updatePasswordAfterReset } from '@/lib/customer/auth-actions'

function form(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

describe('password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ data: { session: null } })
  })

  it('rejects malformed emails without calling Supabase', async () => {
    const out = await requestPasswordReset({ ok: true }, form({ email: 'not-an-email' }))

    expect(out.ok).toBe(false)
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('answers generically (no enumeration) and points the link at /auth/reset', async () => {
    const out = await requestPasswordReset({ ok: true }, form({ email: 'user@example.com' }))

    expect(out).toMatchObject({ ok: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/reset') }),
    )
  })

  it('refuses short and mismatched new passwords before touching Auth', async () => {
    expect((await updatePasswordAfterReset({ ok: true }, form({ password: 'short', confirm: 'short' }))).ok).toBe(
      false,
    )
    expect(
      (await updatePasswordAfterReset({ ok: true }, form({ password: 'long-enough-1', confirm: 'other-1-x' }))).ok,
    ).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('asks for a fresh link when there is no recovery session', async () => {
    const out = await updatePasswordAfterReset(
      { ok: true },
      form({ password: 'long-enough-1', confirm: 'long-enough-1' }),
    )

    expect(out.ok).toBe(false)
    expect(out.message).toMatch(/hết hạn/)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates the password then revokes every session (Q26)', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' } },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    // Next redirect() throws — the revoke must happen BEFORE it.
    await expect(
      updatePasswordAfterReset({ ok: true }, form({ password: 'long-enough-1', confirm: 'long-enough-1' })),
    ).rejects.toThrow()

    expect(updateUser).toHaveBeenCalledWith({ password: 'long-enough-1' })
    expect(globalSignOut).toHaveBeenCalledWith('recovery-token', 'global')
  })
})
