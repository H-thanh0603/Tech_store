import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/format'
import type { ProductCardData } from '@/lib/catalog/types'

interface ProductCardProps {
  product: ProductCardData
}

// Presentational product card. Handles the three states the seed exercises:
// missing image (Dell XPS 13), discount, and out of stock. Pure — no data
// access — so it renders identically in tests and on the server.
export function ProductCard({ product }: ProductCardProps) {
  const href = `/products/${product.slug}`
  const outOfStock = !product.inStock

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised transition-shadow duration-(--duration-fast) hover:shadow-(--shadow-md)">
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        {product.imageUrl ? (
          // Demo images come from placehold.co; a plain img keeps the card a
          // pure presentational unit with no next/image domain config coupling.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            width={800}
            height={800}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-(length:--text-sm) text-fg-subtle"
            aria-hidden="true"
          >
            Chưa có ảnh
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {product.hasDiscount ? <Badge tone="danger">Giảm giá</Badge> : null}
          {outOfStock ? <Badge tone="neutral">Hết hàng</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.brandName ? (
          <p className="text-(length:--text-xs) font-medium uppercase tracking-wide text-fg-subtle">
            {product.brandName}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-(length:--text-base) font-medium text-fg">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto pt-2">
          <p className="text-(length:--text-lg) font-semibold text-fg">
            {formatPrice(product.minPrice)}
          </p>
        </div>
      </div>
    </article>
  )
}
