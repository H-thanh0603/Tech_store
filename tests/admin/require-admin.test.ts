import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminAuthState, redirect } = vi.hoisted(() => ({
  getAdminAuthState: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/admin/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/admin/auth')>(),
  getAdminAuthState,
}))

import { requireAdminMfaPage, requireAdminPage } from '@/lib/admin/require-admin'

const state = {
  userId: '91000000-0000-4000-8000-000000000001',
  role: 'admin' as const,
  displayName: 'Admin',
  email: 'admin@techstore.test',
  actorLabel: 'Admin <admin@techstore.test> [91000000-0000-4000-8000-000000000001]',
}

beforeEach(() => vi.clearAllMocks())

describe('admin MFA page guards', () => {
  it('routes a staff identity without a factor to setup', async () => {
    getAdminAuthState.mockResolvedValue({ ...state, mfaStatus: 'setup_required' })
    await expect(requireAdminPage()).rejects.toThrow('REDIRECT:/admin/mfa/setup')
  })

  it('routes a password-only session with a factor to verification', async () => {
    getAdminAuthState.mockResolvedValue({ ...state, mfaStatus: 'challenge_required' })
    await expect(requireAdminPage()).rejects.toThrow('REDIRECT:/admin/mfa/verify')
  })

  it('returns only the verified staff session after AAL2', async () => {
    getAdminAuthState.mockResolvedValue({ ...state, mfaStatus: 'verified' })
    await expect(requireAdminPage()).resolves.toEqual(state)
  })

  it('prevents a verified session from reopening enrollment', async () => {
    getAdminAuthState.mockResolvedValue({ ...state, mfaStatus: 'verified' })
    await expect(requireAdminMfaPage('setup_required')).rejects.toThrow('REDIRECT:/admin')
  })
})
