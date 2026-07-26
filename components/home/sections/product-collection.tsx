import { ProductCard } from '@/components/commerce/product-card'
import { ProductGrid } from '@/components/commerce/product-grid'
import type { SectionProps } from '@/components/home/sections/types'
import { SectionHeader } from '@/components/ui/section-header'

/**
 * Curated product collection (§4.6–§4.10).
 *
 * `layout: 'rail'` gives a horizontally scrollable row, `'grid'` a full grid —
 * the knob exists so two collections in a row never look like the same band
 * twice, which the spec calls out explicitly.
 *
 * The query layer already dropped this section if the collection had no visible
 * products, so there is no empty state to render here.
 */
export function ProductCollectionSection({ section }: SectionProps) {
  const collection = section.collection
  if (!collection || collection.products.length === 0) {
    return null
  }

  const rail = section.config.layout === 'rail'
  const headingId = `collection-${collection.slug}-heading`

  return (
    <section aria-labelledby={headingId} className="section-y border-b border-border">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? collection.title}
          description={section.subtitle ?? collection.subtitle ?? undefined}
          titleId={headingId}
          actionHref="/products"
          actionLabel="Xem thêm"
        />
        {rail ? (
          <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x">
            {collection.products.map((product) => (
              <li key={product.id} className="flex w-64 shrink-0 snap-start">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <ProductGrid products={collection.products} />
        )}
      </div>
    </section>
  )
}
