import Image from 'next/image'
import Link from 'next/link'

import { ListToggles } from '@/components/commerce/list-toggles'
import { QuickViewButton } from '@/components/commerce/quick-view-button'
import { Badge } from '@/components/ui/badge'
import { Price } from '@/components/ui/price'
import { highlightsForProduct } from '@/lib/catalog/highlights'
import type { ProductCardData } from '@/lib/catalog/types'

interface ProductCardProps {
  product: ProductCardData
  imageLoading?: 'eager' | 'lazy'
}

export function ProductCard({ product, imageLoading = 'lazy' }: ProductCardProps) {
  const href = `/products/${product.slug}`
  const outOfStock = !product.inStock
  const highlights = highlightsForProduct(product.categorySlug, 2)

  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated shadow-sm transition-all duration-(--duration-normal) ease-(--ease-out-expo) hover:-translate-y-1 hover:border-brand/40 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary/60">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            width={800}
            height={600}
            loading={imageLoading}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-(length:--text-sm) text-fg-subtle"
            aria-hidden="true"
          >
            <span className="grid size-12 place-items-center rounded-(--radius-md) border border-dashed border-border-strong">
              ▢
            </span>
            Chưa có ảnh
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[55%] flex-col gap-1.5 z-10">
          {product.hasDiscount ? <Badge tone="danger">Hot Sale</Badge> : null}
          {outOfStock ? <Badge tone="neutral">Hết hàng</Badge> : null}
          {!outOfStock && product.availableStock > 0 && product.availableStock <= 5 ? (
            <Badge tone="warning">Sắp hết</Badge>
          ) : null}
        </div>

        <div className="absolute right-2 top-2 z-10">
          <ListToggles product={product} compact />
        </div>

        <div className="absolute bottom-2 left-2 z-10 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <QuickViewButton slug={product.slug} name={product.name} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-1">
          {product.brandName ? (
            <p className="text-(length:--text-xs) font-bold uppercase tracking-[0.12em] text-brand">
              {product.brandName}
            </p>
          ) : <span />}
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            ★ 4.9
          </span>
        </div>

        <h3 className="line-clamp-2 text-(length:--text-base) font-bold leading-snug tracking-tight text-fg group-hover:text-brand transition-colors">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <ul className="space-y-1">
          {highlights.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-(length:--text-xs) text-fg-muted font-medium">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="line-clamp-1">{line}</span>
            </li>
          ))}
        </ul>

        <div className="relative z-[1] mt-auto flex items-end justify-between gap-2 border-t border-border/80 pt-3">
          <Price amount={product.minPrice} size="md" />
          <span className="inline-flex items-center gap-1 text-(length:--text-xs) font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-md transition-all group-hover:bg-brand group-hover:text-white">
            {outOfStock ? 'Chi tiết' : 'Chọn máy'} →
          </span>
        </div>
      </div>
    </article>
  )
}
