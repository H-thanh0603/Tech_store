export type ProductListStatus = 'all' | 'published' | 'draft' | 'archived'
export type ProductStockFilter = 'all' | 'in' | 'low' | 'out'
export type ProductSortField = 'name' | 'updated_at' | 'stock' | 'price'
export type SortDir = 'asc' | 'desc'

export type ProductListFilters = {
  q: string
  status: ProductListStatus
  categoryId: string
  brandId: string
  stock: ProductStockFilter
  sort: ProductSortField
  dir: SortDir
  page: number
  pageSize: number
}

const STATUSES = new Set<ProductListStatus>(['all', 'published', 'draft', 'archived'])
const STOCKS = new Set<ProductStockFilter>(['all', 'in', 'low', 'out'])
const SORTS = new Set<ProductSortField>(['name', 'updated_at', 'stock', 'price'])

export function parseProductListParams(
  input: Record<string, string | string[] | undefined>,
): ProductListFilters {
  const get = (key: string): string => {
    const raw = input[key]
    return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  }

  const statusRaw = get('status')
  const stockRaw = get('stock')
  const sortRaw = get('sort')
  const dirRaw = get('dir')
  const page = Math.max(1, Number.parseInt(get('page') || '1', 10) || 1)
  const pageSizeRaw = Number.parseInt(get('pageSize') || '20', 10) || 20
  const pageSize = Math.min(100, Math.max(5, pageSizeRaw))

  return {
    q: get('q').trim().slice(0, 120),
    status: STATUSES.has(statusRaw as ProductListStatus)
      ? (statusRaw as ProductListStatus)
      : 'all',
    categoryId: get('categoryId').trim(),
    brandId: get('brandId').trim(),
    stock: STOCKS.has(stockRaw as ProductStockFilter)
      ? (stockRaw as ProductStockFilter)
      : 'all',
    sort: SORTS.has(sortRaw as ProductSortField) ? (sortRaw as ProductSortField) : 'updated_at',
    dir: dirRaw === 'asc' ? 'asc' : 'desc',
    page,
    pageSize,
  }
}

export function buildProductListQuery(
  filters: Partial<ProductListFilters> & { page?: number },
): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.brandId) params.set('brandId', filters.brandId)
  if (filters.stock && filters.stock !== 'all') params.set('stock', filters.stock)
  if (filters.sort && filters.sort !== 'updated_at') params.set('sort', filters.sort)
  if (filters.dir && filters.dir !== 'desc') params.set('dir', filters.dir)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  if (filters.pageSize && filters.pageSize !== 20) params.set('pageSize', String(filters.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
