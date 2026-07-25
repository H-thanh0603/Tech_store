import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminCustomersPage() {
  const access = await requireAdminModule('customers')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Khách hàng"
      description="Tổng hợp khách hàng từ dữ liệu đơn hàng."
      phaseHint="Customer aggregate view sẽ có ở Phase 5. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
