import { afterEach, describe, expect, it } from 'vitest'

import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo/json-ld'
import type { ProductDetail } from '@/lib/catalog/types'

const product: ProductDetail = {
  id: '1',
  name: 'MacBook Air M3',
  slug: 'macbook-air-m3',
  description: 'Laptop mỏng nhẹ',
  categoryId: 'c1',
  categorySlug: 'laptop',
  categoryName: 'Laptop',
  brandName: 'Apple',
  isFeatured: true,
  images: [{ url: 'https://placehold.co/800x800', alt: 'MacBook' }],
  variants: [
    {
      id: 'v1',
      sku: 'MBA-M3',
      attributes: {},
      regularPrice: 30_000_000,
      salePrice: null,
      price: 30_000_000,
      hasDiscount: false,
      availableStock: 3,
      inStock: true,
    },
  ],
  specs: [],
  useCases: [],
  minPrice: 30_000_000,
  hasDiscount: false,
  availableStock: 3,
  inStock: true,
}

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL
})

describe('JSON-LD builders', () => {
  it('builds Product schema with VND offer', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const data = productJsonLd(product)
    expect(data['@type']).toBe('Product')
    expect(data.name).toBe('MacBook Air M3')
    expect((data.offers as { priceCurrency: string }).priceCurrency).toBe('VND')
    expect((data.offers as { lowPrice: number }).lowPrice).toBe(30_000_000)
  })

  it('builds breadcrumb positions', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const data = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Mac', path: '/products/macbook-air-m3' },
    ])
    expect(data['@type']).toBe('BreadcrumbList')
    expect((data.itemListElement as unknown[]).length).toBe(2)
  })
})
