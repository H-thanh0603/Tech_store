import type { ProductDetail } from '@/lib/catalog/types'
import { getSiteUrl } from '@/lib/site'

export function productJsonLd(
  product: ProductDetail,
  rating?: { average: number; count: number },
) {
  const site = getSiteUrl()
  const url = `${site}/products/${product.slug}`
  const image = product.images[0]?.url
  const prices = product.variants.map((v) => v.salePrice ?? v.regularPrice)
  const low = prices.length ? Math.min(...prices) : 0
  const high = prices.length ? Math.max(...prices) : 0

  // Per-variant offers: Google Rich Results and external AI agents consume
  // SKU-level price + availability; the aggregate stays for price-range display.
  const offers = product.variants.map((v) => ({
    '@type': 'Offer',
    url: `${url}?sku=${encodeURIComponent(v.sku)}`,
    sku: v.sku,
    priceCurrency: 'VND',
    price: v.salePrice ?? v.regularPrice,
    itemCondition: 'https://schema.org/NewCondition',
    availability:
      v.availableStock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    seller: { '@type': 'Organization', name: 'TechStore' },
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: image ? [image] : undefined,
    sku: product.variants[0]?.sku,
    brand: product.brandName
      ? { '@type': 'Brand', name: product.brandName }
      : undefined,
    aggregateRating:
      rating && rating.count > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: rating.average,
            reviewCount: rating.count,
          }
        : undefined,
    offers:
      offers.length > 1
        ? {
            '@type': 'AggregateOffer',
            url,
            priceCurrency: 'VND',
            lowPrice: low,
            highPrice: high,
            offerCount: offers.length,
            offers,
          }
        : (offers[0] ?? {
            '@type': 'AggregateOffer',
            url,
            priceCurrency: 'VND',
            lowPrice: low,
            highPrice: high,
            offerCount: product.variants.length,
          }),
  }
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  const site = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${site}${item.path}`,
    })),
  }
}
