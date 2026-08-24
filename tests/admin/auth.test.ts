import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ eq, maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/supabase/auth-server', () => ({
  createSupabaseAuthClient: vi.fn(async () => ({ auth: { getUser }, from })),
}))

import { getAdminSession, requireAdminSession } from '@/lib/admin/auth'

beforeEach(() => {
  vi.clearAllMocks()
  eq.mockReturnValue({ eq, maybeSingle })
  select.mockReturnValue({ eq })
  from.mockReturnValue({ select })
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
      actorLabel: 'Nhân Viên',
    })
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
})
