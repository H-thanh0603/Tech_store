import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListToggles } from '@/components/commerce/list-toggles'
import { ProductGallery } from '@/components/commerce/product-gallery'
import { ProductGrid } from '@/components/commerce/product-grid'
import { ProductHotspots } from '@/components/commerce/product-hotspots'
import { ProductReviews } from '@/components/commerce/product-reviews'
import { ProductViewTracker } from '@/components/commerce/product-view-tracker'
import { VariantSelector } from '@/components/commerce/variant-selector'
import { SectionHeader } from '@/components/ui/section-header'
import { JsonLd } from '@/components/seo/json-ld'
import { highlightsForProduct } from '@/lib/catalog/highlights'
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog/queries'
import {
  getProductHotspots,
  getProductReviews,
  getReviewSummary,
} from '@/lib/catalog/social'
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

const FAQ = [
  {
    q: 'Tôi có cần tài khoản để mua không?',
    a: 'Không bắt buộc — guest checkout vẫn dùng được. Đăng nhập để lưu hồ sơ và lịch sử đơn trên server.',
  },
  {
    q: 'Thanh toán thế nào?',
    a: 'COD hoặc chuyển khoản. Chuyển khoản giữ hàng có thời hạn theo quy tắc demo.',
  },
  {
    q: 'Làm sao theo dõi đơn?',
    a: 'Dùng mã đơn + số điện thoại tại trang Tra cứu đơn.',
  },
] as const

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product: ProductDetail | null = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const [related, reviews, reviewSummary, hotspots] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId),
    getProductReviews(product.id),
    getReviewSummary(product.id),
    getProductHotspots(product.id),
  ])
  const specGroups = groupSpecs(product.specs)
  const highlights = highlightsForProduct(product.categorySlug, 3)

  return (
    <div className="container-store flex flex-col gap-12 py-8 pb-44 sm:gap-14 sm:py-10 lg:pb-10">
      <ProductViewTracker
        product={{
          id: product.id,
          slug: product.slug,
          name: product.name,
          brandName: product.brandName,
          minPrice: product.minPrice,
          imageUrl: product.images[0]?.url ?? null,
          categorySlug: product.categorySlug,
        }}
      />
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
            <Link href="/" className="hover:text-fg">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden className="text-fg-subtle">
            /
          </li>
          <li>
            <Link href="/products" className="hover:text-fg">
              Sản phẩm
            </Link>
          </li>
          <li aria-hidden className="text-fg-subtle">
            /
          </li>
          <li>
            <Link href={`/products?category=${product.categorySlug}`} className="hover:text-fg">
              {product.categoryName}
            </Link>
          </li>
          <li aria-hidden className="text-fg-subtle">
            /
          </li>
          <li className="line-clamp-1 font-medium text-fg" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-2">
            {product.brandName ? (
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                {product.brandName}
              </p>
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-balance text-(length:--text-3xl) font-semibold tracking-tight text-fg">
                {product.name}
              </h1>
              <ListToggles
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  brandName: product.brandName,
                  minPrice: product.minPrice,
                  imageUrl: product.images[0]?.url ?? null,
                  categorySlug: product.categorySlug,
                }}
              />
            </div>
            <p className="text-(length:--text-sm) text-fg-muted">
              {product.categoryName}
              {product.inStock ? ' · Còn hàng' : ' · Hết hàng'}
            </p>
          </div>

          <ul className="space-y-2 rounded-(--radius-lg) border border-border bg-bg-secondary/40 p-4">
            {highlights.map((line) => (
              <li key={line} className="flex gap-2 text-(length:--text-sm) text-fg">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {line}
              </li>
            ))}
          </ul>

          <div className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)">
            <VariantSelector
              variants={product.variants}
              productName={product.name}
              showStickyBar
            />
          </div>

          {product.useCases.length > 0 ? (
            <div>
              <h2 className="text-(length:--text-sm) font-semibold text-fg">Phù hợp với</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.useCases.map((useCase) => (
                  <Link
                    key={useCase}
                    href={`/products?useCase=${encodeURIComponent(useCase)}`}
                    className="rounded-full bg-brand-soft px-3 py-1 text-(length:--text-xs) font-semibold text-brand hover:opacity-90"
                  >
                    {useCase}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {product.description ? (
        <section aria-labelledby="desc-heading" className="max-w-3xl">
          <SectionHeader eyebrow="Mô tả" title="Về sản phẩm" titleId="desc-heading" />
          <p className="text-(length:--text-base) leading-relaxed text-fg-muted">
            {product.description}
          </p>
        </section>
      ) : null}

      {specGroups.length > 0 ? (
        <section aria-labelledby="specs-heading">
          <SectionHeader
            eyebrow="Chi tiết"
            title="Thông số kỹ thuật"
            titleId="specs-heading"
            description="Snapshot từ catalog — chọn biến thể để xem giá và tồn kho tương ứng."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {specGroups.map((group) => (
              <div key={group.group}>
                <h3 className="mb-2 text-(length:--text-xs) font-semibold uppercase tracking-[0.1em] text-fg-subtle">
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

      <ProductHotspots
        imageUrl={product.images[0]?.url ?? null}
        imageAlt={product.images[0]?.alt ?? product.name}
        hotspots={hotspots}
      />

      <ProductReviews
        reviews={reviews}
        average={reviewSummary.average}
        count={reviewSummary.count}
      />

      <section aria-labelledby="faq-heading">
        <SectionHeader eyebrow="FAQ" title="Câu hỏi thường gặp" titleId="faq-heading" />
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-(--radius-lg) border border-border bg-bg-elevated">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-fg marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-fg-subtle transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-(length:--text-sm) leading-relaxed text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading">
          <SectionHeader
            eyebrow="Gợi ý"
            title="Sản phẩm liên quan"
            titleId="related-heading"
            actionHref={`/products?category=${product.categorySlug}`}
            actionLabel="Cùng danh mục"
          />
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  )
}
