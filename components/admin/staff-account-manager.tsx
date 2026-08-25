'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog'
import { FormSection } from '@/components/admin/ui/form-section'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { useToast } from '@/components/admin/ui/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  inviteStaffAccount,
  resetStaffMfa,
  revokeStaffSessions,
  updateStaffAccount,
} from '@/lib/admin/staff-actions'
import type { AdminActionState, AdminStaffAccountRow } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', staff: 'Staff' } as const

type PendingChange = { account: AdminStaffAccountRow; isActive: boolean } | null

export function StaffAccountManager({
  accounts,
  currentUserId,
}: {
  accounts: AdminStaffAccountRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [confirmChange, setConfirmChange] = useState<PendingChange>(null)
  const [confirmMfaReset, setConfirmMfaReset] = useState<AdminStaffAccountRow | null>(null)
  const [state, inviteAction, invitePending] = useActionState(
    async (prev: AdminActionState, formData: FormData) => {
      const result = await inviteStaffAccount(prev, formData)
      toast({
        title: result.ok ? 'Đã gửi lời mời' : 'Không thể mời',
        description: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      if (result.ok) router.refresh()
      return result
    },
    initial,
  )

  function fieldError(key: string) {
    return state.ok ? undefined : state.fieldErrors?.[key]?.[0]
  }

  function runUpdate(form: HTMLFormElement) {
    startTransition(async () => {
      const result = await updateStaffAccount(initial, new FormData(form))
      toast({
        title: result.ok ? 'Đã cập nhật' : 'Không thể cập nhật',
        description: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      if (result.ok) router.refresh()
    })
  }

  function toggleAccount(change: NonNullable<PendingChange>) {
    const form = new FormData()
    form.set('userId', change.account.userId)
    form.set('displayName', change.account.displayName)
    form.set('role', change.account.role)
    form.set('isActive', String(change.isActive))
    startTransition(async () => {
      const result = await updateStaffAccount(initial, form)
      toast({
        title: result.ok ? 'Đã cập nhật' : 'Không thể cập nhật',
        description: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      setConfirmChange(null)
      if (result.ok) router.refresh()
    })
  }

  function resetMfa(account: AdminStaffAccountRow) {
    startTransition(async () => {
      const result = await resetStaffMfa(account.userId)
      toast({
        title: result.ok ? 'Đã đặt lại MFA' : 'Không thể đặt lại MFA',
        description: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      setConfirmMfaReset(null)
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nhân viên</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">MFA</th>
              <th className="px-4 py-3 font-medium">Đăng nhập cuối</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Hành động</span></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isSelf = account.userId === currentUserId
              return (
                <tr key={account.userId} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{account.displayName}</p>
                    <p className="text-(length:--text-xs) text-fg-muted">{account.email}</p>
                    {isSelf ? <span className="text-(length:--text-xs) font-semibold text-accent">Bạn</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        runUpdate(event.currentTarget)
                      }}
                      className="flex min-w-44 gap-2"
                    >
                      <input type="hidden" name="userId" value={account.userId} />
                      <input type="hidden" name="displayName" value={account.displayName} />
                      <input type="hidden" name="isActive" value={String(account.isActive)} />
                      <select
                        name="role"
                        defaultValue={account.role}
                        disabled={isSelf || pending}
                        aria-label={`Vai trò của ${account.displayName}`}
                        className="min-h-10 rounded-(--radius-md) border border-border bg-surface-raised px-2"
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary" disabled={isSelf || pending} className="min-h-10 px-2">
                        Lưu
                      </Button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={account.isActive ? 'active' : 'inactive'}
                      label={account.isActive ? 'Hoạt động' : 'Đã khóa'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={account.mfaVerified ? 'active' : 'pending'}
                      label={account.mfaVerified ? 'Đã bật' : 'Chưa bật'}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                    {account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        disabled={isSelf || pending}
                        className="min-h-10 rounded px-2 text-fg-muted hover:bg-surface-muted disabled:opacity-50"
                        onClick={() => startTransition(async () => {
                          const result = await revokeStaffSessions(account.userId)
                          toast({
                            title: result.ok ? 'Đã thu hồi phiên' : 'Không thể thu hồi',
                            description: result.message,
                            tone: result.ok ? 'success' : 'error',
                          })
                        })}
                      >
                        Thu hồi phiên
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || pending || !account.mfaVerified}
                        className="min-h-10 rounded px-2 text-fg-muted hover:bg-warm-subtle disabled:opacity-50"
                        onClick={() => setConfirmMfaReset(account)}
                      >
                        Đặt lại MFA
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || pending}
                        className={`min-h-10 rounded px-2 disabled:opacity-50 ${
                          account.isActive ? 'text-danger hover:bg-danger-subtle' : 'text-success hover:bg-success-subtle'
                        }`}
                        onClick={() => setConfirmChange({ account, isActive: !account.isActive })}
                      >
                        {account.isActive ? 'Khóa' : 'Mở khóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <FormSection
        title="Mời nhân viên"
        description="Email nhận liên kết đặt mật khẩu. Role chỉ lấy từ hồ sơ server-side."
      >
        <form action={inviteAction} className="space-y-3">
          <Input id="staff-email" name="email" type="email" label="Email" required error={fieldError('email')} />
          <Input id="staff-name" name="displayName" label="Tên hiển thị" required error={fieldError('displayName')} />
          <label className="flex flex-col gap-1.5 text-(length:--text-sm) font-medium text-fg" htmlFor="staff-role">
            Vai trò
            <select
              id="staff-role"
              name="role"
              defaultValue="staff"
              className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={invitePending}>
            {invitePending ? 'Đang gửi…' : 'Gửi lời mời'}
          </Button>
        </form>
      </FormSection>

      <ConfirmDialog
        open={Boolean(confirmChange)}
        title={confirmChange?.isActive ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?'}
        description={confirmChange
          ? `${confirmChange.account.displayName} — ${confirmChange.isActive
            ? 'người dùng phải đăng nhập lại.'
            : 'mọi phiên đăng nhập sẽ bị thu hồi ngay.'}`
          : undefined}
        tone={confirmChange?.isActive ? 'default' : 'danger'}
        loading={pending}
        confirmLabel={confirmChange?.isActive ? 'Mở khóa' : 'Khóa và thu hồi phiên'}
        onCancel={() => setConfirmChange(null)}
        onConfirm={() => { if (confirmChange) toggleAccount(confirmChange) }}
      />

      <ConfirmDialog
        open={Boolean(confirmMfaReset)}
        title="Đặt lại MFA?"
        description={confirmMfaReset
          ? `${confirmMfaReset.displayName} sẽ bị đăng xuất và phải đăng ký ứng dụng xác thực lại.`
          : undefined}
        tone="danger"
        loading={pending}
        confirmLabel="Đặt lại MFA"
        onCancel={() => setConfirmMfaReset(null)}
        onConfirm={() => { if (confirmMfaReset) resetMfa(confirmMfaReset) }}
      />
    </div>
  )
}
