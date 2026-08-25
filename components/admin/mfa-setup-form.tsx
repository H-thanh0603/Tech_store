'use client'

import Image from 'next/image'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminLogout,
  beginAdminMfaEnrollment,
  verifyAdminMfaEnrollment,
} from '@/lib/admin/mfa-actions'
import type { AdminActionState, AdminMfaEnrollment } from '@/lib/admin/types'

const enrollmentInitial: AdminActionState<AdminMfaEnrollment> = { ok: true }
const verifyInitial: AdminActionState = { ok: true }

export function AdminMfaSetupForm() {
  const [enrollment, begin, beginning] = useActionState(beginAdminMfaEnrollment, enrollmentInitial)
  const [verification, verify, verifying] = useActionState(verifyAdminMfaEnrollment, verifyInitial)

  if (!enrollment.ok || !enrollment.data) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        <p className="text-(length:--text-sm) text-fg-muted">
          Dùng Google Authenticator, Microsoft Authenticator hoặc ứng dụng TOTP tương thích.
        </p>
        {!enrollment.ok ? <p role="alert" className="text-sm text-danger">{enrollment.message}</p> : null}
        <form action={begin}>
          <Button type="submit" disabled={beginning} className="w-full">
            {beginning ? 'Đang tạo mã…' : 'Bắt đầu thiết lập'}
          </Button>
        </form>
        <form action={adminLogout}>
          <Button type="submit" variant="ghost" className="w-full">Đăng xuất</Button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div className="mx-auto w-fit rounded-(--radius-lg) border border-border bg-white p-3">
        <Image
          src={enrollment.data.qrCode}
          alt="Mã QR để đăng ký xác thực hai bước"
          width={220}
          height={220}
          unoptimized
        />
      </div>
      <div className="space-y-1 text-(length:--text-sm)">
        <p className="text-fg-muted">Không quét được? Nhập khóa thủ công:</p>
        <code className="block break-all rounded bg-surface-muted p-3 text-center font-semibold tracking-wider">
          {enrollment.data.secret}
        </code>
      </div>
      <form action={verify} className="space-y-4">
        <input type="hidden" name="factorId" value={enrollment.data.factorId} />
        <Input
          id="mfa-setup-code"
          name="code"
          label="Mã xác minh 6 chữ số"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          error={!verification.ok ? verification.fieldErrors?.code?.[0] ?? verification.message : undefined}
        />
        <Button type="submit" disabled={verifying} className="w-full">
          {verifying ? 'Đang xác minh…' : 'Xác minh và vào Admin'}
        </Button>
      </form>
    </div>
  )
}
