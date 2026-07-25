import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminInventoryPage() {
  const access = await requireAdminModule('inventory')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Tồn kho"
      description="Theo dõi và điều chỉnh tồn kho theo biến thể."
      phaseHint="Module tồn kho sẽ có ở Phase 4. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
