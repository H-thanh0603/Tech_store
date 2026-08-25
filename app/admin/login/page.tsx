import { redirect } from 'next/navigation'

import { AdminLoginForm } from '@/components/admin/login-form'
import { getAdminAuthState } from '@/lib/admin/auth'

export default async function AdminLoginPage() {
  const state = await getAdminAuthState()
  if (state?.mfaStatus === 'setup_required') redirect('/admin/mfa/setup')
  if (state?.mfaStatus === 'challenge_required') redirect('/admin/mfa/verify')
  if (state?.mfaStatus === 'verified') redirect('/admin')

  return (
    <section className="space-y-6">
      <div className="text-center">
        <p className="text-(length:--text-sm) font-semibold tracking-tight text-accent">
          TechStore Admin
        </p>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold tracking-tight">
          Đăng nhập
        </h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Dùng tài khoản nhân viên đã được cấp quyền.
        </p>
      </div>
      <AdminLoginForm />
    </section>
  )
}
