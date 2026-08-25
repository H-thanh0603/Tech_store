import { AdminMfaVerifyForm } from '@/components/admin/mfa-verify-form'
import { requireAdminMfaPage } from '@/lib/admin/require-admin'

export default async function AdminMfaVerifyPage() {
  await requireAdminMfaPage('challenge_required')

  return (
    <section className="space-y-6">
      <div className="text-center">
        <p className="text-(length:--text-sm) font-semibold text-accent">TechStore Admin</p>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold">Xác minh hai bước</h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Nhập mã hiện tại từ ứng dụng xác thực.
        </p>
      </div>
      <AdminMfaVerifyForm />
    </section>
  )
}
