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

export const collectionFiltersSchema = z
  .object({
    categorySlug: slug.optional(),
    brandSlug: slug.optional(),
    useCase: slug.optional(),
  })
  .strict()

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
