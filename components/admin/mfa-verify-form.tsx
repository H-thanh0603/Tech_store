'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminLogout, verifyAdminMfaChallenge } from '@/lib/admin/mfa-actions'
import type { AdminActionState } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

export function AdminMfaVerifyForm() {
  const [state, action, pending] = useActionState(verifyAdminMfaChallenge, initial)

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <form action={action} className="space-y-4">
        <Input
          id="mfa-code"
          name="code"
          label="Mã xác minh 6 chữ số"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
          required
          error={!state.ok ? state.fieldErrors?.code?.[0] ?? state.message : undefined}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Đang xác minh…' : 'Xác minh'}
        </Button>
      </form>
      <p className="text-center text-(length:--text-xs) text-fg-muted">
        Mất thiết bị? Nhờ một Admin khác đặt lại MFA cho tài khoản này.
      </p>
      <form action={adminLogout}>
        <Button type="submit" variant="ghost" className="w-full">Đăng xuất</Button>
      </form>
    </div>
  )
}
