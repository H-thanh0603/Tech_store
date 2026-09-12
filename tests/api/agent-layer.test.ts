import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ rpc }),
}))

const { getProducts, getProductBySlug, trackOrder } = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getProductBySlug: vi.fn(),
  trackOrder: vi.fn(),
}))

vi.mock('@/lib/catalog/queries', () => ({
  getProducts,
  getProductBySlug,
  getCatalogFacets: vi.fn(async () => ({ categories: [], brands: [] })),
}))

vi.mock('@/lib/assistant/backend', () => ({ trackOrder }))

import { GET as listProducts } from '@/app/api/agents/products/route'
import { GET as productDetail } from '@/app/api/agents/products/[slug]/route'
import { GET as compareProducts } from '@/app/api/agents/compare/route'
import { GET as trackOrderRoute } from '@/app/api/agents/orders/route'
import { GET as policies } from '@/app/api/agents/policies/route'
import { GET as manifest } from '@/app/api/agents/manifest/route'
import { GET as llmsTxt } from '@/app/llms.txt/route'

const trackedOrder = {
  orderCode: 'TS-ABC123',
  orderStatus: 'processing',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  total: 1000,
  itemCount: 1,
  createdAt: '2026-09-12T00:00:00Z',
}

describe('agent API rate limiting', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
    getProducts.mockReset()
  })

  it('blocks catalog reads when the limiter RPC says so', async () => {
    rpc.mockResolvedValueOnce({ data: true })
    const res = await listProducts(
      new Request('http://localhost/api/agents/products?q=laptop'),
    )
    expect(res.status).toBe(429)
    expect(getProducts).not.toHaveBeenCalled()
  })

  it('blocks order lookups with its own bucket', async () => {
    rpc.mockResolvedValueOnce({ data: true })
    const res = await trackOrderRoute(
      new Request('http://localhost/api/agents/orders?order_code=TS-ABC123&phone=0900000000'),
    )
    expect(res.status).toBe(429)
  })

  it('still answers when the limiter is down (fail-open)', async () => {
    rpc.mockRejectedValueOnce(new Error('db down'))
    getProducts.mockResolvedValueOnce({
      products: [],
      total: 0,
      page: 1,
      pageSize: 12,
      pageCount: 1,
    })
    const res = await listProducts(new Request('http://localhost/api/agents/products'))
    expect(res.status).toBe(200)
  })
})

describe('agent catalog endpoints', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
    getProducts.mockReset()
  })

  it('maps cards to the public agent DTO (no stock counts, absolute urls)', async () => {
    getProducts.mockResolvedValueOnce({
      products: [
        {
          id: 'p1',
          name: 'Laptop X',
          slug: 'laptop-x',
          categorySlug: 'laptop',
          brandName: 'Dell',
          minPrice: 15000000,
          hasDiscount: false,
          availableStock: 3,
          inStock: true,
          imageUrl: '/product-images/laptop-x.jpg',
          imageAlt: 'Laptop X',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
      pageCount: 1,
    })
    const res = await listProducts(
      new Request('http://localhost/api/agents/products?q=laptop&sort=price-asc&page=2'),
    )
    const body = await res.json()

    expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price-asc', page: 2 }))
    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({
      slug: 'laptop-x',
      brand: 'Dell',
      category: 'laptop',
      inStock: true,
      lowStock: true,
    })
    expect(body.products[0].url).toContain('/products/laptop-x')
    expect(body.products[0].imageUrl).toMatch(/^https?:\/\//)
    expect('availableStock' in body.products[0]).toBe(false)
  })

  it('clamps page past the agent ceiling', async () => {
    getProducts.mockResolvedValueOnce({
      products: [],
      total: 0,
      page: 10,
      pageSize: 12,
      pageCount: 1,
    })
    await listProducts(new Request('http://localhost/api/agents/products?page=999'))
    expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 10 }))
  })

  it('returns 404 for a missing product slug', async () => {
    getProductBySlug.mockResolvedValueOnce(null)
    const res = await productDetail(
      new Request('http://localhost/api/agents/products/none'),
      { params: Promise.resolve({ slug: 'none' }) },
    )
    expect(res.status).toBe(404)
  })
})

describe('agent compare endpoint', () => {
  const detailA = {
    id: 'p1',
    name: 'Laptop A',
    slug: 'laptop-a',
    description: null,
    categoryId: 'c1',
    categorySlug: 'laptop',
    categoryName: 'Laptop',
    brandName: 'Dell',
    isFeatured: false,
    images: [],
    variants: [
      {
        id: 'v1',
        sku: 'A-1',
        attributes: {},
        regularPrice: 15000000,
        salePrice: null,
        price: 15000000,
        hasDiscount: false,
        availableStock: 2,
        inStock: true,
      },
    ],
    specs: [],
    useCases: [],
    minPrice: 15000000,
    hasDiscount: false,
    availableStock: 2,
    inStock: true,
  }
  const detailB = { ...detailA, id: 'p2', name: 'Laptop B', slug: 'laptop-b', minPrice: 20000000 }

  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
    getProductBySlug.mockReset()
  })

  it('rejects fewer than 2 or more than 4 slugs', async () => {
    expect(await (await compareProducts(new Request('http://localhost/api/agents/compare?slugs=a'))).status).toBe(400)
    expect(
      await (await compareProducts(new Request('http://localhost/api/agents/compare?slugs=a,b,c,d,e'))).status,
    ).toBe(400)
  })

  it('returns products plus cheapest/in-stock summary', async () => {
    getProductBySlug.mockImplementation(async (slug: string) =>
      slug === 'laptop-a' ? detailA : slug === 'laptop-b' ? detailB : null,
    )
    const res = await compareProducts(
      new Request('http://localhost/api/agents/compare?slugs=laptop-a,laptop-b'),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.products).toHaveLength(2)
    expect(body.unknownSlugs).toEqual([])
    expect(body.summary.cheapest).toMatchObject({ slug: 'laptop-a', minPrice: 15000000 })
    expect(body.summary.inStock).toEqual(expect.arrayContaining(['laptop-a', 'laptop-b']))
    expect(body.products[0]).not.toHaveProperty('availableStock')
  })

  it('reports unknown slugs explicitly instead of fabricating', async () => {
    getProductBySlug.mockImplementation(async (slug: string) =>
      slug === 'laptop-a' ? detailA : null,
    )
    const res = await compareProducts(
      new Request('http://localhost/api/agents/compare?slugs=laptop-a,ghost'),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.products).toHaveLength(1)
    expect(body.unknownSlugs).toEqual(['ghost'])
  })

  it('returns 404 when no slug matches', async () => {
    getProductBySlug.mockResolvedValue(null)
    const res = await compareProducts(
      new Request('http://localhost/api/agents/compare?slugs=ghost1,ghost2'),
    )
    expect(res.status).toBe(404)
  })
})

describe('agent order endpoint', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
  })

  it('requires both order code and phone', async () => {
    const res = await trackOrderRoute(
      new Request('http://localhost/api/agents/orders?order_code=TS-ABC123'),
    )
    expect(res.status).toBe(400)
  })

  it('returns the status summary when code and phone match', async () => {
    trackOrder.mockResolvedValueOnce(trackedOrder)
    const res = await trackOrderRoute(
      new Request('http://localhost/api/agents/orders?order_code=TS-ABC123&phone=0900000000'),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.order.orderCode).toBe('TS-ABC123')
  })

  it('hides the order when phone does not match', async () => {
    trackOrder.mockResolvedValueOnce(null)
    const res = await trackOrderRoute(
      new Request('http://localhost/api/agents/orders?order_code=TS-ABC123&phone=0999999999'),
    )
    expect(res.status).toBe(404)
  })
})

describe('agent policies and manifest', () => {
  it('rejects too-short policy queries', async () => {
    const res = await policies(new Request('http://localhost/api/agents/policies?q=đ'))
    expect(res.status).toBe(400)
  })

  it('returns published passages for a real query', async () => {
    const res = await policies(new Request('http://localhost/api/agents/policies?q=đổi trả'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.passages.length).toBeGreaterThan(0)
    expect(body.passages[0]).toHaveProperty('title')
  })

  it('manifest lists read-only capabilities and the human-only boundary', async () => {
    const res = await manifest()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Object.keys(body.capabilities)).toEqual([
      'searchProducts',
      'getProduct',
      'compareProducts',
      'trackOrder',
      'getPolicy',
      'stageOrderIntent',
    ])
    expect(body.capabilities.searchProducts.endpoint).toContain('/api/v1/agents/products')
    expect(body.notCapabilities.join(' ')).toMatch(/thanh toán/i)
  })

  it('llms.txt is markdown/plain-text and links the endpoints', async () => {
    const res = await llmsTxt()
    const text = await res.text()
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toContain('# TechStore')
    expect(text).toContain('/api/v1/agents/manifest')
    expect(text).toContain('/api/v1/agents/products')
    expect(text).toContain('/api/v1/agents/orders')
    expect(text).toContain('/api/v1/agents/policies')
  })
})
