import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import {
  EditProductForm,
  ImageForm,
  SpecForm,
  UseCasesForm,
  VariantForm,
} from '@/components/admin/product-forms'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminProduct, listBrands, listCategories } from '@/lib/admin/queries'

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { id } = await params
  const [product, categories, brands] = await Promise.all([
    getAdminProduct(id),
    listCategories(),
    listBrands(),
  ])
  if (!product) notFound()

  return (
    <section className="space-y-10">
      <div>
        <Link href="/admin/products" className="text-(length:--text-sm) text-accent hover:underline">
          ← Sản phẩm
        </Link>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold">{product.name}</h1>
        <p className="text-(length:--text-sm) text-fg-muted">
          Storefront:{' '}
          <Link href={`/products/${product.slug}`} className="text-accent hover:underline">
            /products/{product.slug}
          </Link>
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-(length:--text-lg) font-semibold">Thông tin chung</h2>
        <EditProductForm product={product} categories={categories} brands={brands} />
      </div>

      <div className="space-y-3">
        <h2 className="text-(length:--text-lg) font-semibold">Biến thể & tồn kho</h2>
        {product.variants.map((v) => (
          <VariantForm key={v.id} productId={product.id} variant={v} />
        ))}
        <VariantForm productId={product.id} />
      </div>

      <div className="space-y-3">
        <h2 className="text-(length:--text-lg) font-semibold">Ảnh</h2>
        {product.images.map((img) => (
          <ImageForm key={img.id} productId={product.id} image={img} />
        ))}
        <ImageForm productId={product.id} />
      </div>

      <div className="space-y-3">
        <h2 className="text-(length:--text-lg) font-semibold">Thông số</h2>
        {product.specs.map((spec) => (
          <SpecForm key={spec.id} productId={product.id} spec={spec} />
        ))}
        <SpecForm productId={product.id} />
      </div>

      <div className="space-y-3">
        <h2 className="text-(length:--text-lg) font-semibold">Use cases</h2>
        <UseCasesForm productId={product.id} useCases={product.useCases} />
      </div>
    </section>
  )
}
