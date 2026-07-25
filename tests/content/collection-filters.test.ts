import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseCollectionFilters } from '@/lib/content/collection-filters'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseCollectionFilters', () => {
  it('returns an empty filter set for null or undefined', () => {
    expect(parseCollectionFilters(null)).toEqual({})
    expect(parseCollectionFilters(undefined)).toEqual({})
  })

  it('keeps valid slug filters', () => {
    expect(
      parseCollectionFilters({ categorySlug: 'laptop', brandSlug: 'apple', useCase: 'hoc-tap' }),
    ).toEqual({ categorySlug: 'laptop', brandSlug: 'apple', useCase: 'hoc-tap' })
  })

  it('falls back to no filter when a value is not a slug', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(parseCollectionFilters({ categorySlug: 'Laptop; drop table' })).toEqual({})
    expect(warn).toHaveBeenCalled()
  })

  it('rejects unknown keys so an editor typo cannot silently widen a query', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(parseCollectionFilters({ category: 'laptop' })).toEqual({})
    expect(warn).toHaveBeenCalled()
  })
})
