import { MerchantAssistant } from '@/components/admin/assistant/merchant-assistant'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminAssistantPage() {
  const access = await requireAdminModule('assistant')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <section className="space-y-4">
      <PageHeader
        title="Trợ lý AI"
        description="Hỏi đáp vận hành và stage thay đổi (giá, xuất bản, tồn kho). Mọi change chỉ áp dụng khi bạn bấm Duyệt."
      />
      <MerchantAssistant />
    </section>
  )
}
