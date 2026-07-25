import Link from 'next/link'

import { CreateProductForm } from '@/components/admin/product-forms'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { listBrands, listCategories } from '@/lib/admin/queries'

export default async function AdminNewProductPage() {
  const access = await requireAdminModule('products')
  if (isForbidden(access)) return <PermissionDeniedState />

  const [categories, brands] = await Promise.all([listCategories(), listBrands()])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Tạo sản phẩm"
        description="Tạo product + variant đầu tiên + tồn kho trong một thao tác."
        actions={
          <Link href="/admin/products" className="text-(length:--text-sm) text-accent hover:underline">
            ← Danh sách
          </Link>
        }
      />
      <CreateProductForm categories={categories} brands={brands} />
    </section>
  )
}
