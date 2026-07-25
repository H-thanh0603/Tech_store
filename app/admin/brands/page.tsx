import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminBrandsPage() {
  const access = await requireAdminModule('brands')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Thương hiệu"
      description="Quản lý thương hiệu sản phẩm."
      phaseHint="CRUD thương hiệu sẽ có ở Phase 4. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
