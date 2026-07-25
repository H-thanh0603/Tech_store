import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CreateProductForm } from '@/components/admin/product-forms'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { listBrands, listCategories } from '@/lib/admin/queries'

export default async function AdminNewProductPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const [categories, brands] = await Promise.all([listCategories(), listBrands()])

  return (
    <section className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-(length:--text-sm) text-accent hover:underline">
          ← Sản phẩm
        </Link>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold">Tạo sản phẩm</h1>
      </div>
      <CreateProductForm categories={categories} brands={brands} />
    </section>
  )
}
