import { DashboardBlock } from '@/components/admin/dashboard/dashboard-block'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

// Settings status page: shows which integrations are configured. Values are
// never displayed — only present/missing — so the page is safe for any
// settings-role admin.

const INTEGRATIONS: Array<{
  title: string
  description: string
  vars: Array<{ name: string; required: boolean }>
}> = [
  {
    title: 'VNPay',
    description: 'Thanh toán online. Thiếu biến → checkout ẩn phương thức VNPay.',
    vars: [
      { name: 'VNPAY_TMN_CODE', required: true },
      { name: 'VNPAY_SECRET', required: true },
      { name: 'VNP_URL', required: false },
    ],
  },
  {
    title: 'Email (Resend)',
    description: 'Thông báo đơn hàng. Thiếu key → outbox giữ trạng thái pending, checkout không chặn.',
    vars: [
      { name: 'RESEND_API_KEY', required: true },
      { name: 'EMAIL_FROM', required: false },
    ],
  },
  {
    title: 'Scheduled jobs',
    description: 'Cron xử lý outbox + release reservation hết hạn. Gọi qua Bearer token.',
    vars: [{ name: 'CRON_SECRET', required: true }],
  },
]

function EnvStatus({ name, required }: { name: string; required: boolean }) {
  const present = Boolean(process.env[name])
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <code className="text-(length:--text-xs) text-fg">{name}</code>
      <span
        className={`rounded-full px-2 py-0.5 text-(length:--text-xs) font-semibold ${
          present
            ? 'bg-success-subtle text-success'
            : required
              ? 'bg-danger-subtle text-danger'
              : 'bg-surface-muted text-fg-muted'
        }`}
      >
        {present ? 'Đã cấu hình' : required ? 'Thiếu' : 'Tùy chọn'}
      </span>
    </li>
  )
}

export default async function AdminSettingsPage() {
  const access = await requireAdminModule('settings')
  if (isForbidden(access)) return <PermissionDeniedState />

  const adminAuthMode = process.env.ADMIN_AUTH_MODE || 'legacy-secret'

  return (
    <section className="space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Trạng thái cấu hình tích hợp. Giá trị biến môi trường không hiển thị — chỉ có/thiếu."
      />

      <DashboardBlock
        title="Admin auth"
        description="Chế độ đăng nhập admin. Prod bắt buộc supabase."
      >
        <p className="text-(length:--text-sm) text-fg">
          Chế độ hiện tại: <code className="font-semibold">{adminAuthMode}</code>
        </p>
      </DashboardBlock>

      <div className="grid gap-4 lg:grid-cols-3">
        {INTEGRATIONS.map((item) => (
          <DashboardBlock key={item.title} title={item.title} description={item.description}>
            <ul className="divide-y divide-border">
              {item.vars.map((v) => (
                <EnvStatus key={v.name} name={v.name} required={v.required} />
              ))}
            </ul>
          </DashboardBlock>
        ))}
      </div>
    </section>
  )
}
