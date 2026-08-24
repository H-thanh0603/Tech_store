import { ContentManager } from '@/components/admin/content-manager'
import { ErrorState } from '@/components/admin/ui/error-state'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { listAdminContent } from '@/lib/admin/content-queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminContentPage() {
  const access = await requireAdminModule('content')
  if (isForbidden(access)) return <PermissionDeniedState />

  let content
  try {
    content = await listAdminContent()
  } catch {
    return <ErrorState message="Không tải được nội dung storefront." />
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Nội dung storefront" description="Quản lý banner, section trang chủ và menu từ một nơi." />
      <ContentManager {...content} />
    </section>
  )
}
