import { ProductCard } from '@/components/commerce/product-card'
import type { ProductCardData } from '@/lib/catalog/types'

interface ProductGridProps {
  products: ProductCardData[]
}

// Responsive product grid: 1 column on mobile up to 4 on wide desktop, matching
// the 4/12-column layout guidance. Empty state is the caller's responsibility
// (the list page renders a richer empty state with the active filters).
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="flex">
          <div className="flex w-full">
            <ProductCard product={product} />
          </div>
        </li>
      ))}
    </ul>
  )
}
