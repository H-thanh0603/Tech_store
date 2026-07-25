import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminSettingsPage() {
  const access = await requireAdminModule('settings')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Cài đặt"
      description="Cấu hình cửa hàng và tài khoản admin."
      phaseHint="Cài đặt chi tiết sẽ được bổ sung sau. Shell và quyền truy cập đã sẵn sàng."
    />
  )
}
