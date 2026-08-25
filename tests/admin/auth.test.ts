import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const getAuthenticatorAssuranceLevel = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ eq, maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/supabase/auth-server', () => ({
  createSupabaseAuthClient: vi.fn(async () => ({
    auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } },
    from,
  })),
}))

import {
  getAdminSession,
  getAdminAuthState,
  requireAdminPermission,
  requireAdminSession,
} from '@/lib/admin/auth'

beforeEach(() => {
  vi.clearAllMocks()
  eq.mockReturnValue({ eq, maybeSingle })
  select.mockReturnValue({ eq })
  from.mockReturnValue({ select })
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal2', nextLevel: 'aal2' },
    error: null,
  })
})

describe('getAdminSession', () => {
  it('returns null without an authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await getAdminSession()).toBeNull()
  })

  it('returns null when the user has no active admin_users row', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getAdminSession()).toBeNull()
  })

  it('returns null for an invalid role value', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({
      data: { display_name: 'X', role: 'superuser' },
      error: null,
    })
    expect(await getAdminSession()).toBeNull()
  })

  it('returns the session for an active admin row', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({
      data: { display_name: 'Nhân Viên', role: 'manager' },
      error: null,
    })
    expect(await getAdminSession()).toEqual({
      userId: 'u1',
      role: 'manager',
      displayName: 'Nhân Viên',
      email: 'x@y.z',
      actorLabel: 'Nhân Viên <x@y.z> [u1]',
    })
  })

  it('requires setup when the account has no verified factor', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({ data: { display_name: 'X', role: 'admin' }, error: null })
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    })

    await expect(getAdminAuthState()).resolves.toMatchObject({ mfaStatus: 'setup_required' })
    await expect(getAdminSession()).resolves.toBeNull()
  })

  it('requires a TOTP challenge for a password-only session with MFA enrolled', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({ data: { display_name: 'X', role: 'admin' }, error: null })
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    })

    await expect(getAdminAuthState()).resolves.toMatchObject({ mfaStatus: 'challenge_required' })
    await expect(requireAdminPermission('staff.manage')).rejects.toThrow('UNAUTHORIZED')
  })
})

describe('requireAdminSession', () => {
  it('throws UNAUTHORIZED without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(requireAdminSession()).rejects.toThrow('UNAUTHORIZED')
  })

  it('throws FORBIDDEN when the role lacks module access', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({
      data: { display_name: 'X', role: 'staff' },
      error: null,
    })
    await expect(requireAdminSession('settings')).rejects.toThrow('FORBIDDEN')
  })

  it('rejects privilege escalation through a server mutation permission', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({
      data: { display_name: 'Manager', role: 'manager' },
      error: null,
    })
    await expect(requireAdminPermission('staff.manage')).rejects.toThrow('FORBIDDEN')
  })

  it('allows staff to update orders but not mark payment paid', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } } })
    maybeSingle.mockResolvedValue({
      data: { display_name: 'Staff', role: 'staff' },
      error: null,
    })
    await expect(requireAdminPermission('orders.update')).resolves.toMatchObject({ role: 'staff' })
    await expect(requireAdminPermission('orders.mark_paid')).rejects.toThrow('FORBIDDEN')
  })
})
