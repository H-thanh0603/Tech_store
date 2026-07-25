import type { MetadataRoute } from 'next'

import { getProducts } from '@/lib/catalog/queries'
import { getSiteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/track-order`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  try {
    const productRoutes: MetadataRoute.Sitemap = []
    let page = 1
    let pageCount = 1
    while (page <= pageCount && page <= 20) {
      const result = await getProducts({ page })
      pageCount = result.pageCount
      for (const p of result.products) {
        productRoutes.push({
          url: `${base}/products/${p.slug}`,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
      page += 1
    }
    return [...staticRoutes, ...productRoutes]
  } catch {
    // Local/CI without Supabase should still produce a valid sitemap.
    return staticRoutes
  }
}
