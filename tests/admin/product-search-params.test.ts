import { describe, expect, it } from 'vitest'

import {
  buildProductListQuery,
  parseProductListParams,
} from '@/lib/admin/product-search-params'

describe('product list search params', () => {
  it('parses defaults safely', () => {
    const parsed = parseProductListParams({})
    expect(parsed.status).toBe('all')
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(20)
    expect(parsed.sort).toBe('updated_at')
    expect(parsed.dir).toBe('desc')
  })

  it('accepts known filters and clamps page', () => {
    const parsed = parseProductListParams({
      q: 'iphone',
      status: 'draft',
      stock: 'low',
      sort: 'price',
      dir: 'asc',
      page: '0',
      pageSize: '500',
    })
    expect(parsed.q).toBe('iphone')
    expect(parsed.status).toBe('draft')
    expect(parsed.stock).toBe('low')
    expect(parsed.sort).toBe('price')
    expect(parsed.dir).toBe('asc')
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(100)
  })

  it('builds query string omitting defaults', () => {
    expect(buildProductListQuery({ page: 1, status: 'all' })).toBe('')
    expect(buildProductListQuery({ q: 'mac', status: 'published', page: 2 })).toBe(
      '?q=mac&status=published&page=2',
    )
  })
})
