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
    // Single variant collapses to one Offer (no aggregate wrapper).
    const offer = data.offers as { '@type': string; priceCurrency: string; price: number }
    expect(offer['@type']).toBe('Offer')
    expect(offer.priceCurrency).toBe('VND')
    expect(offer.price).toBe(30_000_000)
  })

  it('emits per-variant offers with seller and condition', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const two = {
      ...product,
      variants: [
        ...product.variants,
        {
          ...product.variants[0],
          id: 'v2',
          sku: 'MBA-M3-16',
          regularPrice: 35_000_000,
          price: 35_000_000,
        },
      ],
    }
    const data = productJsonLd(two)
    const offers = data.offers as {
      '@type': string
      offers: Array<{
        '@type': string
        sku: string
        price: number
        itemCondition: string
        seller: { name: string }
      }>
    }
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.offers).toHaveLength(2)
    expect(offers.offers[0].itemCondition).toBe('https://schema.org/NewCondition')
    expect(offers.offers[0].seller.name).toBe('TechStore')
  })

  it('adds aggregateRating only when reviews exist', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    expect(productJsonLd(product).aggregateRating).toBeUndefined()
    expect(
      productJsonLd(product, { average: 4.5, count: 12 }).aggregateRating,
    ).toEqual({ '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 12 })
    expect(
      productJsonLd(product, { average: 0, count: 0 }).aggregateRating,
    ).toBeUndefined()
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
