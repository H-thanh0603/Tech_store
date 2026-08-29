import Link from 'next/link'

import { ProductCsvImportForm } from '@/components/admin/product-csv-import'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminProductImportPage() {
  const access = await requireAdminModule('products')
  if (isForbidden(access)) return <PermissionDeniedState />

  return (
    <section className="space-y-6">
      <PageHeader
        title="Import sản phẩm từ CSV"
        description="Dán file CSV để tạo / cập nhật hàng loạt. Tối đa 500 dòng / lần."
        actions={
          <Link
            href="/admin/products"
            className="text-(length:--text-sm) text-accent hover:underline"
          >
            ← Danh sách
          </Link>
        }
      />
      <ProductCsvImportForm />
    </section>
  )
}
