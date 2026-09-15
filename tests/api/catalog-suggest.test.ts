import { beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimited = vi.fn(async () => ({ data: false }))
const suggestProducts = vi.fn(async () => [
  {
    id: 'p1',
    slug: 'iphone-15',
    name: 'iPhone 15',
    brandName: 'Apple',
    minPrice: 20000000,
    imageUrl: 'https://example.com/p1.jpg',
    inStock: true,
  },
])

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ rpc: rateLimited }),
}))

vi.mock('@/lib/catalog/queries', () => ({
  suggestProducts: (...args: unknown[]) => suggestProducts(...args),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))

import { GET } from '@/app/api/catalog/suggest/route'

function get(url: string) {
  return GET(new Request(url))
}

describe('catalog suggest endpoint', () => {
  beforeEach(() => {
    rateLimited.mockClear()
    suggestProducts.mockClear()
    rateLimited.mockResolvedValue({ data: false })
  })

  it('short-circuits queries under 2 chars without touching the DB', async () => {
    const response = await get('http://localhost/api/catalog/suggest?q=a')
    const body = (await response.json()) as { products: unknown[]; empty: boolean }

    expect(response.status).toBe(200)
    expect(body.products).toEqual([])
    expect(body.empty).toBe(false)
    expect(rateLimited).not.toHaveBeenCalled()
    expect(suggestProducts).not.toHaveBeenCalled()
  })

  it('returns mapped product cards for a valid query', async () => {
    const response = await get('http://localhost/api/catalog/suggest?q=iphone')
    const body = (await response.json()) as {
      query: string
      products: Array<{ slug: string; minPrice: number }>
      empty: boolean
    }

    expect(response.status).toBe(200)
    expect(body.query).toBe('iphone')
    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({ slug: 'iphone-15', minPrice: 20000000 })
    expect(body.empty).toBe(false)
    expect(rateLimited).toHaveBeenCalledOnce()
  })

  it('returns 429 without querying when throttled', async () => {
    rateLimited.mockResolvedValueOnce({ data: true })
    const response = await get('http://localhost/api/catalog/suggest?q=iphone')

    expect(response.status).toBe(429)
    expect(suggestProducts).not.toHaveBeenCalled()
  })

  it('fail-opens when the limiter errors', async () => {
    rateLimited.mockRejectedValueOnce(new Error('limiter down'))
    const response = await get('http://localhost/api/catalog/suggest?q=iphone')

    expect(response.status).toBe(200)
    expect(suggestProducts).toHaveBeenCalledOnce()
  })
})
