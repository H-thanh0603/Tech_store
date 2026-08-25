// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StaffAccountManager } from '@/components/admin/staff-account-manager'
import { ToastProvider } from '@/components/admin/ui/toast-provider'
import type { AdminStaffAccountRow } from '@/lib/admin/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/admin/staff-actions', () => ({
  inviteStaffAccount: vi.fn(),
  resetStaffMfa: vi.fn(),
  updateStaffAccount: vi.fn(),
  revokeStaffSessions: vi.fn(),
}))

const accounts: AdminStaffAccountRow[] = [
  {
    userId: '91000000-0000-4000-8000-000000000001',
    email: 'admin@techstore.test',
    displayName: 'Current Admin',
    role: 'admin',
    isActive: true,
    createdAt: '2026-08-24T00:00:00Z',
    updatedAt: '2026-08-24T00:00:00Z',
    disabledAt: null,
    lastSignInAt: '2026-08-24T01:00:00Z',
    mfaVerified: true,
  },
  {
    userId: '91000000-0000-4000-8000-000000000002',
    email: 'staff@techstore.test',
    displayName: 'Store Staff',
    role: 'staff',
    isActive: true,
    createdAt: '2026-08-24T00:00:00Z',
    updatedAt: '2026-08-24T00:00:00Z',
    disabledAt: null,
    lastSignInAt: null,
    mfaVerified: true,
  },
]

describe('StaffAccountManager', () => {
  it('disables self-management while exposing controls for another account', () => {
    render(
      <ToastProvider>
        <StaffAccountManager accounts={accounts} currentUserId={accounts[0].userId} />
      </ToastProvider>,
    )

    const selfRow = screen.getByRole('row', { name: /Current Admin/ })
    expect(within(selfRow).getByRole('combobox')).toBeDisabled()
    expect(within(selfRow).getByRole('button', { name: 'Thu hồi phiên' })).toBeDisabled()
    expect(within(selfRow).getByRole('button', { name: 'Đặt lại MFA' })).toBeDisabled()
    expect(within(selfRow).getByRole('button', { name: 'Khóa' })).toBeDisabled()

    const staffRow = screen.getByRole('row', { name: /Store Staff/ })
    expect(within(staffRow).getByRole('combobox')).toBeEnabled()
    expect(within(staffRow).getByRole('button', { name: 'Thu hồi phiên' })).toBeEnabled()
    expect(within(staffRow).getByRole('button', { name: 'Đặt lại MFA' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gửi lời mời' })).toBeEnabled()
  })
})
