import Image from 'next/image'
import Link from 'next/link'

import { getProducts } from '@/lib/catalog/queries'
import { formatPrice } from '@/lib/format'

// Cheap in-stock suggestions under the cart items to lift AOV. Server
// component: no client JS, links to the PDP where the variant is chosen.
export async function CartUpsell({ excludeSlugs }: { excludeSlugs: string[] }) {
  let products
  try {
    const result = await getProducts({ sort: 'price-asc', inStock: true, page: 1 })
    products = result.products.filter((p) => !excludeSlugs.includes(p.slug)).slice(0, 4)
  } catch {
    return null
  }
  if (products.length === 0) return null

  return (
    <section
      aria-labelledby="cart-upsell-heading"
      className="rounded-(--radius-lg) border border-border bg-surface-raised p-5"
    >
      <h2 id="cart-upsell-heading" className="text-(length:--text-base) font-semibold text-fg">
        Có thể mua thêm
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/products/${product.slug}`}
              className="flex items-center gap-3 rounded-(--radius-md) border border-border bg-bg-primary p-2.5 transition-colors hover:border-brand/50"
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.imageAlt ?? product.name}
                  width={96}
                  height={72}
                  className="size-14 shrink-0 rounded-(--radius-sm) object-cover"
                />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-(--radius-sm) border border-dashed border-border text-fg-subtle">
                  ▢
                </span>
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-(length:--text-sm) font-medium text-fg">
                  {product.name}
                </span>
                <span className="mt-0.5 block text-(length:--text-sm) font-semibold tabular-nums text-brand">
                  {formatPrice(product.minPrice)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
