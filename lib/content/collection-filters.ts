import { z } from 'zod'

/**
 * Narrowing options for a dynamic homepage collection
 * (`homepage_collections.filters`).
 *
 * JSONB is untrusted input like any other, so it is parsed before it can reach a
 * query builder: `.strict()` rejects unknown keys and each value is length-capped
 * to a slug shape. A malformed value degrades to "no filter" rather than dropping
 * the whole collection, because an unfiltered rail is still useful.
 */

const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'must be a lowercase slug')

/**
 * Price bound in whole VND, matching the storefront catalog's integer-only
 * money convention. Capped at 500,000,000 VND — far above any real product —
 * so a typo cannot produce a query with no practical upper bound.
 */
const priceBound = z.number().int().min(0).max(500_000_000)

export const collectionFiltersSchema = z
  .object({
    categorySlug: slug.optional(),
    brandSlug: slug.optional(),
    useCase: slug.optional(),
    /** §4.6: price-band tabs (e.g. "under 10M", "10-20M") for a category. */
    minPrice: priceBound.optional(),
    maxPrice: priceBound.optional(),
  })
  .strict()
  .refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
    message: 'minPrice must not exceed maxPrice',
  })

export type CollectionFilters = z.infer<typeof collectionFiltersSchema>

export function parseCollectionFilters(raw: unknown): CollectionFilters {
  const result = collectionFiltersSchema.safeParse(raw ?? {})
  if (result.success) {
    return result.data
  }
  console.warn(
    `[content] ignoring invalid collection filters: ${result.error.issues
      .map((issue) => issue.message)
      .join('; ')}`,
  )
  return {}
}
