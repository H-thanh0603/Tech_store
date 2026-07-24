import { CATALOG_SORTS, type CatalogFilters, type CatalogSort } from '@/lib/catalog/types'

// Next.js delivers searchParams as string | string[] | undefined per key.
// This module is the single boundary that turns that untrusted shape into
// typed CatalogFilters, and back into a query string for links. Normalization
// of ranges/pages still happens in normalizeCatalogFilters; here we only parse.

export type RawSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function parseNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value)
  if (raw === undefined || raw.trim() === '') {
    return undefined
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseSort(value: string | string[] | undefined): CatalogSort | undefined {
  const raw = firstValue(value)
  return raw !== undefined && (CATALOG_SORTS as readonly string[]).includes(raw)
    ? (raw as CatalogSort)
    : undefined
}

export function parseCatalogSearchParams(params: RawSearchParams): CatalogFilters {
  return {
    query: firstValue(params.q),
    category: firstValue(params.category),
    brand: firstValue(params.brand),
    useCase: firstValue(params.useCase),
    minPrice: parseNumber(params.minPrice),
    maxPrice: parseNumber(params.maxPrice),
    inStock: firstValue(params.inStock) === '1',
    sort: parseSort(params.sort),
    page: parseNumber(params.page),
  }
}

// Builds a stable query string from filters, dropping defaults so URLs stay
// clean. Used by sort controls and pagination links to preserve context.
export function buildCatalogQuery(filters: CatalogFilters): string {
  const search = new URLSearchParams()

  if (filters.query) {
    search.set('q', filters.query)
  }
  if (filters.category) {
    search.set('category', filters.category)
  }
  if (filters.brand) {
    search.set('brand', filters.brand)
  }
  if (filters.useCase) {
    search.set('useCase', filters.useCase)
  }
  if (filters.minPrice !== undefined) {
    search.set('minPrice', String(filters.minPrice))
  }
  if (filters.maxPrice !== undefined) {
    search.set('maxPrice', String(filters.maxPrice))
  }
  if (filters.inStock) {
    search.set('inStock', '1')
  }
  if (filters.sort && filters.sort !== 'relevance') {
    search.set('sort', filters.sort)
  }
  if (filters.page !== undefined && filters.page > 1) {
    search.set('page', String(filters.page))
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}
