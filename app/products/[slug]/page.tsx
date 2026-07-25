import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProductGallery } from '@/components/commerce/product-gallery'
import { ProductGrid } from '@/components/commerce/product-grid'
import { VariantSelector } from '@/components/commerce/variant-selector'
import { JsonLd } from '@/components/seo/json-ld'
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog/queries'
import type { ProductDetail, ProductSpecData } from '@/lib/catalog/types'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo/json-ld'
import { getSiteUrl } from '@/lib/site'
import { formatPrice } from '@/lib/format'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) {
    return { title: 'Không tìm thấy sản phẩm' }
  }
  const site = getSiteUrl()
  const url = `${site}/products/${product.slug}`
  const image = product.images[0]?.url
  const description =
    product.description ??
    `${product.name} — từ ${formatPrice(product.minPrice)}. Mua tại TechStore.`
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url,
      images: image ? [{ url: image, alt: product.images[0]?.alt ?? product.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
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
    <div className="flex flex-col gap-12 sm:gap-14">
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Trang chủ', path: '/' },
          { name: 'Sản phẩm', path: '/products' },
          { name: product.categoryName, path: `/products?category=${product.categorySlug}` },
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <nav aria-label="Breadcrumb" className="text-(length:--text-sm) text-fg-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/products" className="transition-colors hover:text-fg">
              Sản phẩm
            </Link>
          </li>
          <li aria-hidden="true" className="text-fg-subtle">
            /
          </li>
          <li>
            <Link
              href={`/products?category=${product.categorySlug}`}
              className="transition-colors hover:text-fg"
            >
              {product.categoryName}
            </Link>
          </li>
          <li aria-hidden="true" className="text-fg-subtle">
            /
          </li>
          <li className="line-clamp-1 font-medium text-fg" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-2">
            {product.brandName ? (
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                {product.brandName}
              </p>
            ) : null}
            <h1 className="text-balance text-(length:--text-3xl) font-semibold tracking-tight text-fg">
              {product.name}
            </h1>
          </div>

          <div className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)">
            <VariantSelector variants={product.variants} />
          </div>

          {product.description ? (
            <p className="max-w-prose text-(length:--text-base) leading-relaxed text-fg-muted">
              {product.description}
            </p>
          ) : null}
        </div>
      </div>

      {specGroups.length > 0 ? (
        <section aria-labelledby="specs-heading" className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Chi tiết</p>
            <h2 id="specs-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight text-fg">
              Thông số kỹ thuật
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {specGroups.map((group) => (
              <div key={group.group} className="flex flex-col gap-2">
                <h3 className="text-(length:--text-xs) font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                  {group.group}
                </h3>
                <dl className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
                  {group.items.map((spec) => (
                    <div
                      key={`${spec.group}-${spec.label}`}
                      className="flex gap-4 px-4 py-3 sm:items-center"
                    >
                      <dt className="w-32 shrink-0 text-(length:--text-sm) text-fg-muted sm:w-40">
                        {spec.label}
                      </dt>
                      <dd className="text-(length:--text-sm) font-medium text-fg">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Gợi ý</p>
            <h2 id="related-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight text-fg">
              Sản phẩm liên quan
            </h2>
          </div>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  )
}
