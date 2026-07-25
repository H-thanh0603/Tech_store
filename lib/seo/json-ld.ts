import type { ProductDetail } from '@/lib/catalog/types'
import { getSiteUrl } from '@/lib/site'

export function productJsonLd(product: ProductDetail) {
  const site = getSiteUrl()
  const url = `${site}/products/${product.slug}`
  const image = product.images[0]?.url
  const prices = product.variants.map((v) => v.salePrice ?? v.regularPrice)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const inStock = product.variants.some((v) => v.availableStock > 0)

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
    offers: {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'VND',
      lowPrice: low,
      highPrice: high,
      offerCount: product.variants.length,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
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
