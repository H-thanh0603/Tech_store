import { AdminMfaSetupForm } from '@/components/admin/mfa-setup-form'
import { requireAdminMfaPage } from '@/lib/admin/require-admin'

export default async function AdminMfaSetupPage() {
  await requireAdminMfaPage('setup_required')

  return (
    <section className="space-y-6">
      <div className="text-center">
        <p className="text-(length:--text-sm) font-semibold text-accent">TechStore Admin</p>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold">Thiết lập xác thực hai bước</h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Mọi tài khoản nhân viên phải dùng MFA trước khi truy cập hệ thống.
        </p>
      </div>
      <AdminMfaSetupForm />
    </section>
  )
}
