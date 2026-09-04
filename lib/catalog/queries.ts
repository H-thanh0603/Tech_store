import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseServerClient } from '@/lib/supabase/server'

import {
  CATALOG_PAGE_SIZE,
  CATALOG_SORTS,
  type CatalogFilters,
  type CatalogSort,
  type NormalizedCatalogFilters,
  type ProductCardData,
  type ProductDetail,
  type ProductImageData,
  type ProductListResult,
  type ProductSpecData,
  type ProductVariantData,
} from '@/lib/catalog/types'

// Mirrors the SQL normalize_vietnamese() used to build search_vector_nd so a
// diacritic query ("điện thoại") and a no-diacritic one ("dien thoai") hit the
// same normalized vector.
const VIETNAMESE_DIACRITICS =
  'àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ'
const VIETNAMESE_ASCII =
  'aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiioooooooooooooooooouuuuuuuuuuuyyyyy'

function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => {
      const index = VIETNAMESE_DIACRITICS.indexOf(ch)
      return index >= 0 ? VIETNAMESE_ASCII[index] : ch
    })
    .join('')
}

// Raw shape of a catalog_products view row. Numeric columns arrive as strings
// from PostgREST (numeric) or numbers; both are handled by toNumber.
interface CatalogRow {
  id: string
  name: string
  slug: string
  category_slug: string
  brand_name: string | null
  min_price: number | string | null
  has_discount: boolean | null
  available_stock: number | string | null
  image_url: string | null
  image_alt: string | null
}

interface VariantRow {
  id: string
  sku: string
  attributes: Record<string, unknown> | null
  regular_price: number | string
  sale_price: number | string | null
  is_active: boolean
  inventory: { quantity: number; reserved_quantity: number } | null
}

interface DetailRow {
  id: string
  name: string
  slug: string
  description: string | null
  category_id: string
  is_featured: boolean
  categories: { name: string; slug: string } | null
  brands: { name: string } | null
  product_images: Array<{ url: string; alt_text: string | null; sort_order: number }> | null
  product_specs: Array<{ group_name: string; label: string; value: string; sort_order: number }> | null
  product_use_cases: Array<{ use_case: string }> | null
  product_variants: VariantRow[] | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toAttributes(value: Record<string, unknown> | null): Record<string, string> {
  if (!value) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw !== null && raw !== undefined) {
      result[key] = String(raw)
    }
  }
  return result
}

function isSort(value: string | undefined): value is CatalogSort {
  return value !== undefined && (CATALOG_SORTS as readonly string[]).includes(value)
}

export type CatalogFacetOption = { name: string; slug: string }

async function fetchCatalogFacets(): Promise<{
  categories: CatalogFacetOption[]
  brands: CatalogFacetOption[]
}> {
  const db = getSupabaseServerClient()
  const [categoriesRes, brandsRes] = await Promise.all([
    db.from('categories').select('name, slug').eq('is_active', true).order('name'),
    db.from('brands').select('name, slug').eq('is_active', true).order('name'),
  ])
  if (categoriesRes.error || brandsRes.error) {
    console.warn('[catalog] failed to load facets', categoriesRes.error || brandsRes.error)
    return { categories: [], brands: [] }
  }
  return {
    categories: (categoriesRes.data ?? []).map((row) => ({
      name: String(row.name),
      slug: String(row.slug),
    })),
    brands: (brandsRes.data ?? []).map((row) => ({
      name: String(row.name),
      slug: String(row.slug),
    })),
  }
}

/** Active categories/brands for filter UI (public read via RLS). Cached 5m to avoid per-request facet queries on /products (FE-201). */
export const getCatalogFacets = unstable_cache(fetchCatalogFacets, ['catalog-facets'], {
  revalidate: 300,
  tags: ['catalog-facets'],
})

// Normalizes untrusted filter input to safe, concrete values. Page is clamped
// to 1..MAX_PAGE (deep OFFSET pages cost DB linearly and no real shopper walks
// past 1200 products by pager; use search/filters instead), price bounds drop
// non-finite/negative values, and an unknown sort falls back to 'relevance'.
// Pure: no DB access, easy to test.
export const MAX_CATALOG_PAGE = 100

export function normalizeCatalogFilters(filters: CatalogFilters): NormalizedCatalogFilters {
  const rawPage = filters.page
  const page =
    typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage >= 1
      ? Math.min(Math.floor(rawPage), MAX_CATALOG_PAGE)
      : 1

  const normalizePrice = (value: number | undefined): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

  let minPrice = normalizePrice(filters.minPrice)
  let maxPrice = normalizePrice(filters.maxPrice)
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    // Swap inverted bounds instead of returning an empty result set.
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  const query = filters.query?.trim()

  return {
    query: query ? query : undefined,
    category: filters.category || undefined,
    brand: filters.brand || undefined,
    useCase: filters.useCase || undefined,
    minPrice,
    maxPrice,
    inStock: filters.inStock === true,
    sort: isSort(filters.sort) ? filters.sort : 'relevance',
    page,
  }
}

// Pure row → card DTO mapper. Available stock is clamped for display only;
// the DB already forbids negative stock, this guards against view arithmetic.
export function mapCatalogRowToCard(row: CatalogRow): ProductCardData {
  const availableStock = Math.max(toNumber(row.available_stock), 0)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categorySlug: row.category_slug,
    brandName: row.brand_name,
    minPrice: toNumber(row.min_price),
    hasDiscount: row.has_discount === true,
    availableStock,
    inStock: availableStock > 0,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
  }
}

function mapVariant(row: VariantRow): ProductVariantData {
  const regularPrice = toNumber(row.regular_price)
  const salePrice = row.sale_price === null ? null : toNumber(row.sale_price)
  const price = salePrice ?? regularPrice
  const availableStock = row.inventory
    ? Math.max(row.inventory.quantity - row.inventory.reserved_quantity, 0)
    : 0
  return {
    id: row.id,
    sku: row.sku,
    attributes: toAttributes(row.attributes),
    regularPrice,
    salePrice,
    price,
    hasDiscount: salePrice !== null && salePrice < regularPrice,
    availableStock,
    inStock: availableStock > 0,
  }
}

// Pure detail row → DTO mapper. Only active variants surface, images/specs are
// sorted, and product-level price/stock are derived from the active variants.
export function mapProductDetail(row: DetailRow): ProductDetail {
  const variants = (row.product_variants ?? [])
    .filter((v) => v.is_active)
    .map(mapVariant)

  const images: ProductImageData[] = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => ({ url: img.url, alt: img.alt_text }))

  const specs: ProductSpecData[] = (row.product_specs ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((spec) => ({ group: spec.group_name, label: spec.label, value: spec.value }))

  const useCases = (row.product_use_cases ?? []).map((uc) => uc.use_case)

  const prices = variants.map((v) => v.price)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const availableStock = variants.reduce((sum, v) => sum + v.availableStock, 0)

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    categorySlug: row.categories?.slug ?? '',
    categoryName: row.categories?.name ?? '',
    brandName: row.brands?.name ?? null,
    isFeatured: row.is_featured,
    images,
    variants,
    specs,
    useCases,
    minPrice,
    hasDiscount: variants.some((v) => v.hasDiscount),
    availableStock,
    inStock: availableStock > 0,
  }
}

const CATALOG_SELECT =
  'id, name, slug, category_slug, brand_name, min_price, has_discount, available_stock, image_url, image_alt'

const DETAIL_SELECT = `
  id, name, slug, description, category_id, is_featured,
  categories!inner ( name, slug ),
  brands ( name ),
  product_images ( url, alt_text, sort_order ),
  product_specs ( group_name, label, value, sort_order ),
  product_use_cases ( use_case ),
  product_variants ( id, sku, attributes, regular_price, sale_price, is_active, inventory ( quantity, reserved_quantity ) )
`

export async function getProducts(
  filters: CatalogFilters,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<ProductListResult> {
  const normalized = normalizeCatalogFilters(filters)
  const from = (normalized.page - 1) * CATALOG_PAGE_SIZE
  const to = from + CATALOG_PAGE_SIZE - 1

  let builder = supabase.from('catalog_products').select(CATALOG_SELECT, { count: 'exact' })

  if (normalized.query) {
    builder = builder.textSearch(
      'search_vector_nd',
      normalizeVietnamese(normalized.query),
      { type: 'plain', config: 'simple' },
    )
  }
  if (normalized.category) {
    builder = builder.eq('category_slug', normalized.category)
  }
  if (normalized.brand) {
    builder = builder.eq('brand_slug', normalized.brand)
  }
  if (normalized.useCase) {
    builder = builder.contains('use_cases', [normalized.useCase])
  }
  if (normalized.minPrice !== undefined) {
    builder = builder.gte('min_price', normalized.minPrice)
  }
  if (normalized.maxPrice !== undefined) {
    builder = builder.lte('min_price', normalized.maxPrice)
  }
  if (normalized.inStock) {
    builder = builder.gt('available_stock', 0)
  }

  switch (normalized.sort) {
    case 'price-asc':
      builder = builder.order('min_price', { ascending: true, nullsFirst: false })
      break
    case 'price-desc':
      builder = builder.order('min_price', { ascending: false, nullsFirst: false })
      break
    case 'newest':
      builder = builder.order('created_at', { ascending: false })
      break
    default:
      builder = builder.order('is_featured', { ascending: false }).order('created_at', {
        ascending: false,
      })
  }

  const { data, error, count } = await builder.range(from, to)
  if (error) {
    console.warn('[catalog] failed to load products', error)
    return {
      products: [],
      total: 0,
      page: normalized.page,
      pageSize: CATALOG_PAGE_SIZE,
      pageCount: 1,
    }
  }

  const products = ((data ?? []) as CatalogRow[]).map(mapCatalogRowToCard)
  const total = count ?? 0

  return {
    products,
    total,
    page: normalized.page,
    pageSize: CATALOG_PAGE_SIZE,
    pageCount: Math.max(Math.ceil(total / CATALOG_PAGE_SIZE), 1),
  }
}

export async function getProductBySlug(
  slug: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error('Failed to load product')
  }
  if (!data) {
    return null
  }

  return mapProductDetail(data as unknown as DetailRow)
}

export async function getRecommendedProducts(
  productId: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<ProductCardData[]> {
  const { data, error } = await supabase.rpc('recommend_products', {
    p_product_id: productId,
    p_limit: 4,
  })

  if (error) {
    throw new Error('Failed to load product recommendations')
  }

  return ((data ?? []) as CatalogRow[]).map(mapCatalogRowToCard)
}
