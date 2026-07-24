import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProductCard } from '@/components/commerce/product-card'
import { ProductGallery } from '@/components/commerce/product-gallery'
import { VariantSelector } from '@/components/commerce/variant-selector'
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog/queries'
import type { ProductDetail, ProductSpecData } from '@/lib/catalog/types'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) {
    return { title: 'Không tìm thấy sản phẩm | TechStore' }
  }
  return {
    title: `${product.name} | TechStore`,
    description: product.description ?? undefined,
  }
}

// Groups specs by their group_name while preserving the DB sort order within
// and across groups (the query already sorted by sort_order).
function groupSpecs(specs: ProductSpecData[]): Array<{ group: string; items: ProductSpecData[] }> {
  const groups: Array<{ group: string; items: ProductSpecData[] }> = []
  for (const spec of specs) {
    const existing = groups.find((g) => g.group === spec.group)
    if (existing) {
      existing.items.push(spec)
    } else {
      groups.push({ group: spec.group, items: [spec] })
    }
  }
  return groups
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product: ProductDetail | null = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const related = await getRelatedProducts(product.id, product.categoryId)
  const specGroups = groupSpecs(product.specs)

  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Breadcrumb" className="text-(length:--text-sm) text-fg-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/products" className="hover:text-fg">
              Sản phẩm
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/products?category=${product.categorySlug}`}
              className="hover:text-fg"
            >
              {product.categoryName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-fg" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {product.brandName ? (
              <p className="text-(length:--text-sm) font-medium uppercase tracking-wide text-fg-subtle">
                {product.brandName}
              </p>
            ) : null}
            <h1 className="text-(length:--text-3xl) font-semibold tracking-tight text-fg">
              {product.name}
            </h1>
          </div>

          <VariantSelector variants={product.variants} />

          {product.description ? (
            <p className="max-w-prose text-(length:--text-base) leading-relaxed text-fg-muted">
              {product.description}
            </p>
          ) : null}
        </div>
      </div>

      {specGroups.length > 0 ? (
        <section aria-labelledby="specs-heading" className="flex flex-col gap-4">
          <h2 id="specs-heading" className="text-(length:--text-xl) font-semibold text-fg">
            Thông số kỹ thuật
          </h2>
          <div className="flex flex-col gap-6">
            {specGroups.map((group) => (
              <div key={group.group} className="flex flex-col gap-2">
                <h3 className="text-(length:--text-sm) font-semibold uppercase tracking-wide text-fg-subtle">
                  {group.group}
                </h3>
                <dl className="divide-y divide-border rounded-(--radius-md) border border-border">
                  {group.items.map((spec) => (
                    <div key={`${spec.group}-${spec.label}`} className="flex gap-4 px-4 py-2.5">
                      <dt className="w-40 shrink-0 text-(length:--text-sm) text-fg-muted">
                        {spec.label}
                      </dt>
                      <dd className="text-(length:--text-sm) text-fg">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="flex flex-col gap-4">
          <h2 id="related-heading" className="text-(length:--text-xl) font-semibold text-fg">
            Sản phẩm liên quan
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id} className="flex">
                <div className="flex w-full">
                  <ProductCard product={item} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
