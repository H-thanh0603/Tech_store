import type { ProductVariantData } from '@/lib/catalog/types'

// Pure selection logic shared by the variant selector and its tests. Kept out
// of the component so the "never buy an out-of-stock variant" rule (blueprint
// §6.2) is verified without rendering.

// Resolves the active variant for a given selected id, falling back to the
// first variant when the id is missing or unknown (e.g. a stale URL param).
export function resolveSelectedVariant(
  variants: readonly ProductVariantData[],
  selectedId: string | undefined,
): ProductVariantData | undefined {
  if (variants.length === 0) {
    return undefined
  }
  const match = selectedId ? variants.find((v) => v.id === selectedId) : undefined
  return match ?? variants[0]
}

// Add-to-cart is allowed only when a concrete variant is selected and it has
// available stock. This is display/UX gating; the server still re-checks stock.
export function canAddToCart(variant: ProductVariantData | undefined): boolean {
  return variant !== undefined && variant.inStock && variant.availableStock > 0
}

// Human-readable label for a variant, built from its attribute values. Falls
// back to the SKU when a variant has no attributes (seed: Tai Nghe has {}).
export function variantLabel(variant: ProductVariantData): string {
  const values = Object.values(variant.attributes)
  return values.length > 0 ? values.join(' · ') : variant.sku
}
