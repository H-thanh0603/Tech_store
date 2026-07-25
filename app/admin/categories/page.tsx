import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminCategoriesPage() {
  const access = await requireAdminModule('categories')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Danh mục"
      description="Quản lý danh mục sản phẩm."
      phaseHint="CRUD danh mục sẽ có ở Phase 4. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
