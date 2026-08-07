import { describe, expect, it, vi } from 'vitest'

import {
  getProductBySlug,
  getProducts,
  mapCatalogRowToCard,
  mapProductDetail,
  normalizeCatalogFilters,
} from '@/lib/catalog/queries'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog/types'

describe('normalizeCatalogFilters', () => {
  it('defaults page to 1 when missing', () => {
    expect(normalizeCatalogFilters({}).page).toBe(1)
  })

  it('normalizes zero, negative, and fractional pages to a positive integer', () => {
    expect(normalizeCatalogFilters({ page: 0 }).page).toBe(1)
    expect(normalizeCatalogFilters({ page: -5 }).page).toBe(1)
    expect(normalizeCatalogFilters({ page: 3.9 }).page).toBe(3)
    expect(normalizeCatalogFilters({ page: Number.NaN }).page).toBe(1)
  })

  it('falls back to relevance for an unknown sort', () => {
    expect(normalizeCatalogFilters({ sort: 'bogus' as never }).sort).toBe('relevance')
    expect(normalizeCatalogFilters({ sort: 'price-asc' }).sort).toBe('price-asc')
  })

  it('drops negative and non-finite price bounds', () => {
    const result = normalizeCatalogFilters({ minPrice: -1, maxPrice: Number.POSITIVE_INFINITY })
    expect(result.minPrice).toBeUndefined()
    expect(result.maxPrice).toBeUndefined()
  })

  it('swaps inverted price bounds', () => {
    const result = normalizeCatalogFilters({ minPrice: 900, maxPrice: 100 })
    expect(result.minPrice).toBe(100)
    expect(result.maxPrice).toBe(900)
  })

  it('trims blank query and string filters to undefined', () => {
    const result = normalizeCatalogFilters({ query: '   ', category: '' })
    expect(result.query).toBeUndefined()
    expect(result.category).toBeUndefined()
  })

  it('defaults inStock to false unless explicitly true', () => {
    expect(normalizeCatalogFilters({}).inStock).toBe(false)
    expect(normalizeCatalogFilters({ inStock: true }).inStock).toBe(true)
  })
})

describe('mapCatalogRowToCard', () => {
  it('coerces string numerics and derives inStock', () => {
    const card = mapCatalogRowToCard({
      id: 'p1',
      name: 'Laptop',
      slug: 'laptop',
      category_slug: 'laptop',
      brand_name: 'Dell',
      min_price: '35990000.00',
      has_discount: false,
      available_stock: '5',
      image_url: null,
      image_alt: null,
    })
    expect(card.minPrice).toBe(35990000)
    expect(card.availableStock).toBe(5)
    expect(card.inStock).toBe(true)
    expect(typeof card.minPrice).toBe('number')
  })

  it('clamps negative stock to zero and marks out of stock', () => {
    const card = mapCatalogRowToCard({
      id: 'p2',
      name: 'X',
      slug: 'x',
      category_slug: 'c',
      brand_name: null,
      min_price: null,
      has_discount: null,
      available_stock: -3,
      image_url: null,
      image_alt: null,
    })
    expect(card.availableStock).toBe(0)
    expect(card.inStock).toBe(false)
    expect(card.minPrice).toBe(0)
    expect(card.hasDiscount).toBe(false)
  })
})

describe('mapProductDetail', () => {
  it('exposes only active variants and derives price/stock', () => {
    const detail = mapProductDetail({
      id: 'p1',
      name: 'MacBook',
      slug: 'macbook',
      description: 'desc',
      category_id: 'cat1',
      is_featured: true,
      categories: { name: 'Laptop', slug: 'laptop' },
      brands: { name: 'Apple' },
      product_images: [
        { url: 'b.jpg', alt_text: 'b', sort_order: 1 },
        { url: 'a.jpg', alt_text: 'a', sort_order: 0 },
      ],
      product_specs: [{ group_name: 'Perf', label: 'Chip', value: 'M3', sort_order: 0 }],
      product_use_cases: [{ use_case: 'study' }],
      product_variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          attributes: { ram: '8GB' },
          regular_price: 32990000,
          sale_price: 30990000,
          is_active: true,
          inventory: { quantity: 10, reserved_quantity: 2 },
        },
        {
          id: 'v2',
          sku: 'SKU-2',
          attributes: null,
          regular_price: 27990000,
          sale_price: null,
          is_active: false,
          inventory: { quantity: 5, reserved_quantity: 0 },
        },
      ],
    })

    expect(detail.variants).toHaveLength(1)
    expect(detail.variants[0].price).toBe(30990000)
    expect(detail.variants[0].hasDiscount).toBe(true)
    expect(detail.variants[0].availableStock).toBe(8)
    expect(detail.minPrice).toBe(30990000)
    expect(detail.availableStock).toBe(8)
    expect(detail.inStock).toBe(true)
    expect(detail.images.map((i) => i.url)).toEqual(['a.jpg', 'b.jpg'])
    expect(detail.brandName).toBe('Apple')
    expect(detail.categorySlug).toBe('laptop')
  })
})

// Minimal thenable query-builder mock: every chained method returns `this`,
// and awaiting the builder resolves to the configured response.
function mockBuilder(response: unknown) {
  const builder: Record<string, unknown> = {}
  const methods = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lte',
    'contains',
    'order',
    'limit',
    'range',
    'textSearch',
  ]
  for (const method of methods) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(response))
  builder.then = (resolve: (value: unknown) => unknown) => resolve(response)
  return builder
}

function mockClient(response: unknown) {
  const builder = mockBuilder(response)
  return {
    from: vi.fn(() => builder),
  } as never
}

describe('getProductBySlug', () => {
  it('returns null for an unknown slug', async () => {
    const client = mockClient({ data: null, error: null })
    const result = await getProductBySlug('does-not-exist', client)
    expect(result).toBeNull()
  })

  it('throws a UI-safe error, never the DB error, on failure', async () => {
    const client = mockClient({ data: null, error: { message: 'pg: relation missing' } })
    await expect(getProductBySlug('x', client)).rejects.toThrow('Failed to load product')
  })
})

describe('getProducts', () => {
  it('returns typed cards with pagination metadata', async () => {
    const client = mockClient({
      data: [
        {
          id: 'p1',
          name: 'Laptop',
          slug: 'laptop',
          category_slug: 'laptop',
          brand_name: 'Dell',
          min_price: '35990000',
          has_discount: false,
          available_stock: '5',
          image_url: null,
          image_alt: null,
        },
      ],
      error: null,
      count: 1,
    })

    const result = await getProducts({ page: 1 }, client)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].minPrice).toBe(35990000)
    expect(result.total).toBe(1)
    expect(result.pageSize).toBe(CATALOG_PAGE_SIZE)
    expect(result.pageCount).toBe(1)
  })

  it('falls back to an empty list and logs the DB error on query failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dbError = { message: 'boom' }
    const client = mockClient({ data: null, error: dbError, count: null })

    const result = await getProducts({}, client)
    expect(result.products).toEqual([])
    expect(result.total).toBe(0)
    expect(result.pageCount).toBe(1)
    expect(warn).toHaveBeenCalledWith('[catalog] failed to load products', dbError)
  })
})
