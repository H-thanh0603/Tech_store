import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminCouponsPage() {
  const access = await requireAdminModule('coupons')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Khuyến mãi"
      description="Quản lý mã giảm giá."
      phaseHint="Coupon CRUD sẽ có ở Phase 5. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
