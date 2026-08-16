import type { MetadataRoute } from 'next'

import { getCatalogFacets, getProducts } from '@/lib/catalog/queries'
import { getSiteUrl } from '@/lib/site'

function absoluteImageUrl(path: string | null, base: string): string | undefined {
  if (!path) return undefined
  try {
    return new URL(path, base).toString()
  } catch {
    return undefined
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/track-order`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  try {
    const [{ categories, brands }] = await Promise.all([getCatalogFacets()])
    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${base}/products?category=${encodeURIComponent(c.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
    const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => ({
      url: `${base}/products?brand=${encodeURIComponent(b.slug)}`,
      changeFrequency: 'monthly',
      priority: 0.4,
    }))

    let productRoutes: MetadataRoute.Sitemap = []
    let page = 1
    let pageCount = 1
    while (page <= pageCount && page <= 20) {
      const result = await getProducts({ page })
      pageCount = result.pageCount
      productRoutes = productRoutes.concat(
        result.products.map((p) => {
          const image = absoluteImageUrl(p.imageUrl, base)
          return {
            url: `${base}/products/${p.slug}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            images: image ? [image] : undefined,
          }
        }),
      )
      page += 1
    }

    return [
      ...staticRoutes,
      ...categoryRoutes,
      ...brandRoutes,
      ...productRoutes,
    ]
  } catch {
    // Local/CI without Supabase should still produce a valid sitemap.
    return staticRoutes
  }
}
