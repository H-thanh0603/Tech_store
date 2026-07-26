import { redirect } from 'next/navigation'

import { AdminLoginForm } from '@/components/admin/login-form'
import { adminAuthMode, isAdminAuthenticated } from '@/lib/admin/auth'

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect('/admin')
  }

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
          {adminAuthMode() === 'supabase'
            ? 'Dùng tài khoản nhân viên đã được cấp quyền.'
            : 'Chế độ ADMIN_SECRET chuyển tiếp chỉ dành cho local/test.'}
        </p>
      </div>
      <AdminLoginForm mode={adminAuthMode()} />
    </section>
  )
}
