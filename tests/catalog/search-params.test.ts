import { describe, expect, it } from 'vitest'

import { buildCatalogQuery, parseCatalogSearchParams } from '@/lib/catalog/search-params'

describe('parseCatalogSearchParams', () => {
  it('parses a full set of params into typed filters', () => {
    const filters = parseCatalogSearchParams({
      q: 'macbook',
      category: 'laptop',
      brand: 'apple',
      useCase: 'hoc-tap',
      minPrice: '1000',
      maxPrice: '2000',
      inStock: '1',
      sort: 'price-asc',
      page: '2',
    })
    expect(filters).toEqual({
      query: 'macbook',
      category: 'laptop',
      brand: 'apple',
      useCase: 'hoc-tap',
      minPrice: 1000,
      maxPrice: 2000,
      inStock: true,
      sort: 'price-asc',
      page: 2,
    })
  })

  it('takes the first value when a param repeats', () => {
    expect(parseCatalogSearchParams({ category: ['laptop', 'phone'] }).category).toBe('laptop')
  })

  it('drops non-numeric price and page values', () => {
    const filters = parseCatalogSearchParams({ minPrice: 'abc', page: '' })
    expect(filters.minPrice).toBeUndefined()
    expect(filters.page).toBeUndefined()
  })

  it('treats an unknown sort as undefined so normalization can default it', () => {
    expect(parseCatalogSearchParams({ sort: 'bogus' }).sort).toBeUndefined()
  })

  it('only enables inStock for the literal "1"', () => {
    expect(parseCatalogSearchParams({ inStock: 'true' }).inStock).toBe(false)
    expect(parseCatalogSearchParams({ inStock: '1' }).inStock).toBe(true)
  })
})

describe('buildCatalogQuery', () => {
  it('returns an empty string when only defaults are present', () => {
    expect(buildCatalogQuery({})).toBe('')
    expect(buildCatalogQuery({ sort: 'relevance', page: 1 })).toBe('')
  })

  it('omits relevance sort and page 1 but keeps other values', () => {
    expect(buildCatalogQuery({ category: 'laptop', sort: 'relevance', page: 1 })).toBe(
      '?category=laptop',
    )
  })

  it('serializes active filters', () => {
    const query = buildCatalogQuery({ query: 'dell', brand: 'dell', inStock: true, page: 3 })
    const params = new URLSearchParams(query.slice(1))
    expect(params.get('q')).toBe('dell')
    expect(params.get('brand')).toBe('dell')
    expect(params.get('inStock')).toBe('1')
    expect(params.get('page')).toBe('3')
  })

  it('round-trips through parse', () => {
    const original = { query: 'x', category: 'laptop', sort: 'newest' as const, page: 4 }
    const parsed = parseCatalogSearchParams(
      Object.fromEntries(new URLSearchParams(buildCatalogQuery(original).slice(1))),
    )
    expect(parsed.query).toBe('x')
    expect(parsed.category).toBe('laptop')
    expect(parsed.sort).toBe('newest')
    expect(parsed.page).toBe(4)
  })
})
