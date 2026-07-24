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
    <article className="group relative flex w-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm) transition-all duration-(--duration-normal) ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-border-strong hover:shadow-(--shadow-md)">
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
            className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,var(--color-surface-muted),var(--color-surface-glow))] text-(length:--text-sm) text-fg-subtle"
            aria-hidden="true"
          >
            <span className="grid size-12 place-items-center rounded-(--radius-md) border border-dashed border-border-strong text-(length:--text-lg)">
              ▢
            </span>
            Chưa có ảnh
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/15 to-transparent opacity-60" />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {product.hasDiscount ? <Badge tone="danger">Giảm giá</Badge> : null}
          {outOfStock ? <Badge tone="neutral">Hết hàng</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.brandName ? (
          <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            {product.brandName}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-(length:--text-base) font-semibold leading-snug tracking-tight text-fg">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/80 pt-3">
          <p className="text-(length:--text-lg) font-semibold tabular-nums tracking-tight text-fg">
            {formatPrice(product.minPrice)}
          </p>
          <span className="text-(length:--text-xs) font-medium text-fg-subtle transition-colors group-hover:text-accent">
            Xem →
          </span>
        </div>
      </div>
    </article>
  )
}
