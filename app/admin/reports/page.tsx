import { ModulePlaceholder } from '@/components/admin/ui/module-placeholder'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminReportsPage() {
  const access = await requireAdminModule('reports')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <ModulePlaceholder
      title="Báo cáo"
      description="Báo cáo doanh thu và vận hành nâng cao."
      phaseHint="Reports chuyên sâu nằm ngoài Phase 1–5 foundation; dashboard chart ở Phase 2."
    />
  )
}
