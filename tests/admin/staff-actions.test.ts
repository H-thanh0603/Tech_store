import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminPermission, getSupabaseAdminClient } = vi.hoisted(() => ({
  requireAdminPermission: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/auth', () => ({ requireAdminPermission }))
vi.mock('@/lib/admin/supabase', () => ({ getSupabaseAdminClient }))

import {
  inviteStaffAccount,
  resetStaffMfa,
  revokeStaffSessions,
  updateStaffAccount,
} from '@/lib/admin/staff-actions'

const actor = {
  userId: '91000000-0000-4000-8000-000000000001',
  role: 'admin',
  displayName: 'Admin',
  email: 'admin@techstore.test',
  actorLabel: 'Admin <admin@techstore.test> [91000000-0000-4000-8000-000000000001]',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('staff account actions', () => {
  it('stops privilege escalation before touching the service-role client', async () => {
    requireAdminPermission.mockRejectedValue(new Error('FORBIDDEN'))
    const form = new FormData()
    form.set('email', 'target@techstore.test')
    form.set('displayName', 'Target User')
    form.set('role', 'admin')

    await expect(inviteStaffAccount({ ok: true }, form)).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    })
    expect(getSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it('rejects self-demotion before calling Auth or the database', async () => {
    requireAdminPermission.mockResolvedValue(actor)
    const form = new FormData()
    form.set('userId', actor.userId)
    form.set('displayName', actor.displayName)
    form.set('role', 'staff')
    form.set('isActive', 'true')

    await expect(updateStaffAccount({ ok: true }, form)).resolves.toMatchObject({
      ok: false,
      code: 'SELF_MANAGEMENT_FORBIDDEN',
    })
    expect(getSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it('rejects revoking the current admin session from staff management', async () => {
    requireAdminPermission.mockResolvedValue(actor)

    await expect(revokeStaffSessions(actor.userId)).resolves.toMatchObject({
      ok: false,
      code: 'SELF_MANAGEMENT_FORBIDDEN',
    })
    expect(getSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it('invites a new Auth user then registers its server-side role with actor identity', async () => {
    requireAdminPermission.mockResolvedValue(actor)
    const rpc = vi.fn().mockResolvedValue({ data: { code: 'OK' }, error: null })
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: '91000000-0000-4000-8000-000000000002' } },
      error: null,
    })
    getSupabaseAdminClient.mockReturnValue({
      auth: { admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        inviteUserByEmail,
      } },
      rpc,
    })
    const form = new FormData()
    form.set('email', 'new.staff@techstore.test')
    form.set('displayName', 'New Staff')
    form.set('role', 'staff')

    await expect(inviteStaffAccount({ ok: true }, form)).resolves.toMatchObject({ ok: true })
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      'new.staff@techstore.test',
      expect.objectContaining({ data: { display_name: 'New Staff' } }),
    )
    expect(rpc).toHaveBeenCalledWith('admin_manage_staff_account', expect.objectContaining({
      p_actor_user_id: actor.userId,
      p_target_user_id: '91000000-0000-4000-8000-000000000002',
      p_role: 'staff',
    }))
  })

  it('locks the database profile before banning the Auth user', async () => {
    requireAdminPermission.mockResolvedValue(actor)
    const rpc = vi.fn().mockResolvedValue({ data: { code: 'OK' }, error: null })
    const updateUserById = vi.fn().mockResolvedValue({ data: { user: {} }, error: null })
    getSupabaseAdminClient.mockReturnValue({
      auth: { admin: { updateUserById } },
      rpc,
    })
    const form = new FormData()
    form.set('userId', '91000000-0000-4000-8000-000000000002')
    form.set('displayName', 'Store Staff')
    form.set('role', 'staff')
    form.set('isActive', 'false')

    await expect(updateStaffAccount({ ok: true }, form)).resolves.toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledWith('admin_manage_staff_account', expect.objectContaining({
      p_is_active: false,
    }))
    expect(updateUserById).toHaveBeenCalledWith(
      '91000000-0000-4000-8000-000000000002',
      { ban_duration: '876000h' },
    )
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(updateUserById.mock.invocationCallOrder[0])
  })

  it('deletes another staff factor, revokes sessions, and records the reset actor', async () => {
    requireAdminPermission.mockResolvedValue(actor)
    const deleteFactor = vi.fn().mockResolvedValue({ data: { id: 'factor-1' }, error: null })
    const rpc = vi.fn().mockResolvedValue({ data: { code: 'OK', revokedSessions: 1 }, error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    getSupabaseAdminClient.mockReturnValue({
      auth: { admin: { mfa: {
        listFactors: vi.fn().mockResolvedValue({
          data: { factors: [{ id: 'factor-1' }] }, error: null,
        }),
        deleteFactor,
      } } },
      rpc,
      from: vi.fn(() => ({ insert })),
    })

    await expect(resetStaffMfa('91000000-0000-4000-8000-000000000002')).resolves.toMatchObject({
      ok: true,
    })
    expect(deleteFactor).toHaveBeenCalledWith({
      userId: '91000000-0000-4000-8000-000000000002',
      id: 'factor-1',
    })
    expect(rpc).toHaveBeenCalledWith('admin_revoke_staff_sessions', expect.objectContaining({
      p_actor_user_id: actor.userId,
    }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'staff_mfa_reset',
      actor_user_id: actor.userId,
    }))
  })
})
