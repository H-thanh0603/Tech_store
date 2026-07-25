import Image from 'next/image'
import Link from 'next/link'

import { ListToggles } from '@/components/commerce/list-toggles'
import { Badge } from '@/components/ui/badge'
import { Price } from '@/components/ui/price'
import { highlightsForProduct } from '@/lib/catalog/highlights'
import type { ProductCardData } from '@/lib/catalog/types'

interface ProductCardProps {
  product: ProductCardData
}

export function ProductCard({ product }: ProductCardProps) {
  const href = `/products/${product.slug}`
  const outOfStock = !product.inStock
  const highlights = highlightsForProduct(product.categorySlug, 2)

  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm) transition-[transform,box-shadow,border-color] duration-(--duration-normal) ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-border-strong hover:shadow-(--shadow-md)">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            width={800}
            height={600}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.03]"
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

        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[55%] flex-col gap-1.5">
          {product.hasDiscount ? <Badge tone="danger">Giảm giá</Badge> : null}
          {outOfStock ? <Badge tone="neutral">Hết hàng</Badge> : null}
          {!outOfStock && product.availableStock > 0 && product.availableStock <= 5 ? (
            <Badge tone="warning">Sắp hết</Badge>
          ) : null}
        </div>

        <div className="absolute right-2 top-2">
          <ListToggles product={product} compact />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {product.brandName ? (
          <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
            {product.brandName}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-(length:--text-base) font-semibold leading-snug tracking-tight text-fg">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <ul className="space-y-1">
          {highlights.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-(length:--text-xs) text-fg-muted">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="line-clamp-1">{line}</span>
            </li>
          ))}
        </ul>

        <div className="relative z-[1] mt-auto flex items-end justify-between gap-2 border-t border-border/80 pt-3">
          <Price amount={product.minPrice} size="md" />
          <span className="text-(length:--text-xs) font-semibold text-fg-subtle transition-colors group-hover:text-brand">
            {outOfStock ? 'Xem chi tiết' : 'Chọn máy'} →
          </span>
        </div>
      </div>
    </article>
  )
}
