import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAdminAuthState,
  createSupabaseAuthClient,
  getSupabaseAdminClient,
  redirect,
} = vi.hoisted(() => ({
  getAdminAuthState: vi.fn(),
  createSupabaseAuthClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/admin/auth', () => ({ getAdminAuthState }))
vi.mock('@/lib/admin/auth-actions', () => ({ adminLogout: vi.fn() }))
vi.mock('@/lib/admin/supabase', () => ({ getSupabaseAdminClient }))
vi.mock('@/lib/supabase/auth-server', () => ({ createSupabaseAuthClient }))

import {
  beginAdminMfaEnrollment,
  verifyAdminMfaChallenge,
  verifyAdminMfaEnrollment,
} from '@/lib/admin/mfa-actions'

const actor = {
  userId: '91000000-0000-4000-8000-000000000001',
  role: 'admin',
  displayName: 'Admin',
  email: 'admin@techstore.test',
  actorLabel: 'Admin <admin@techstore.test> [91000000-0000-4000-8000-000000000001]',
  mfaStatus: 'setup_required',
}

beforeEach(() => vi.clearAllMocks())

describe('admin MFA actions', () => {
  it('does not enroll from the wrong MFA state', async () => {
    getAdminAuthState.mockResolvedValue({ ...actor, mfaStatus: 'challenge_required' })

    await expect(beginAdminMfaEnrollment({ ok: true }, new FormData())).resolves.toMatchObject({
      ok: false,
      code: 'MFA_STATE_CHANGED',
    })
    expect(createSupabaseAuthClient).not.toHaveBeenCalled()
  })

  it('removes stale unverified factors before starting TOTP enrollment', async () => {
    getAdminAuthState.mockResolvedValue(actor)
    const unenroll = vi.fn().mockResolvedValue({ error: null })
    const enroll = vi.fn().mockResolvedValue({
      data: { id: '92000000-0000-4000-8000-000000000001', totp: {
        qr_code: 'data:image/svg+xml;utf-8,qr', secret: 'SECRET',
      } },
      error: null,
    })
    createSupabaseAuthClient.mockResolvedValue({ auth: { mfa: {
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [{ id: 'old', status: 'unverified' }] }, error: null,
      }),
      unenroll,
      enroll,
    } } })

    await expect(beginAdminMfaEnrollment({ ok: true }, new FormData())).resolves.toEqual({
      ok: true,
      data: {
        factorId: '92000000-0000-4000-8000-000000000001',
        qrCode: 'data:image/svg+xml;utf-8,qr',
        secret: 'SECRET',
      },
    })
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'old' })
    expect(enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: 'totp' }))
  })

  it('rejects an enrollment factor not owned by the current user', async () => {
    getAdminAuthState.mockResolvedValue(actor)
    const challengeAndVerify = vi.fn()
    createSupabaseAuthClient.mockResolvedValue({ auth: { mfa: {
      listFactors: vi.fn().mockResolvedValue({ data: { all: [] }, error: null }),
      challengeAndVerify,
    } } })
    const form = new FormData()
    form.set('factorId', '92000000-0000-4000-8000-000000000001')
    form.set('code', '123456')

    await expect(verifyAdminMfaEnrollment({ ok: true }, form)).resolves.toMatchObject({
      ok: false,
      code: 'MFA_STATE_CHANGED',
    })
    expect(challengeAndVerify).not.toHaveBeenCalled()
  })

  it('selects the verified server-side factor for a login challenge', async () => {
    getAdminAuthState.mockResolvedValue({ ...actor, mfaStatus: 'challenge_required' })
    const challengeAndVerify = vi.fn().mockResolvedValue({ error: null })
    createSupabaseAuthClient.mockResolvedValue({ auth: { mfa: {
      listFactors: vi.fn().mockResolvedValue({
        data: { totp: [{ id: 'verified-factor' }] }, error: null,
      }),
      challengeAndVerify,
    } } })
    const form = new FormData()
    form.set('code', '123456')

    await verifyAdminMfaChallenge({ ok: true }, form)
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: 'verified-factor', code: '123456' })
    expect(redirect).toHaveBeenCalledWith('/admin')
  })
})
