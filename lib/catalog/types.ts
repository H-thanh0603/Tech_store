// DTOs returned to Server Components. These deliberately do not mirror raw
// Supabase rows: prices/stock are normalized numbers and image fields are
// flattened so the UI never touches database shapes or nullable join noise.

export type CatalogSort = 'relevance' | 'price-asc' | 'price-desc' | 'newest'

export interface CatalogFilters {
  query?: string
  category?: string
  brand?: string
  useCase?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: CatalogSort
  page?: number
}

// Filters after normalization: page is always a positive integer and sort
// always has a concrete value, so query builders never branch on undefined.
export interface NormalizedCatalogFilters {
  query?: string
  category?: string
  brand?: string
  useCase?: string
  minPrice?: number
  maxPrice?: number
  inStock: boolean
  sort: CatalogSort
  page: number
}

export interface ProductCardData {
  id: string
  name: string
  slug: string
  categorySlug: string
  brandName: string | null
  minPrice: number
  hasDiscount: boolean
  availableStock: number
  inStock: boolean
  imageUrl: string | null
  imageAlt: string | null
}

export interface ProductListResult {
  products: ProductCardData[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface ProductVariantData {
  id: string
  sku: string
  attributes: Record<string, string>
  regularPrice: number
  salePrice: number | null
  price: number
  hasDiscount: boolean
  availableStock: number
  inStock: boolean
}

export interface ProductImageData {
  url: string
  alt: string | null
}

export interface ProductSpecData {
  group: string
  label: string
  value: string
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  categoryId: string
  categorySlug: string
  categoryName: string
  brandName: string | null
  isFeatured: boolean
  images: ProductImageData[]
  variants: ProductVariantData[]
  specs: ProductSpecData[]
  useCases: string[]
  minPrice: number
  hasDiscount: boolean
  availableStock: number
  inStock: boolean
}

export const CATALOG_PAGE_SIZE = 12

export const CATALOG_SORTS: readonly CatalogSort[] = [
  'relevance',
  'price-asc',
  'price-desc',
  'newest',
] as const
