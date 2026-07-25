import type { Metadata } from 'next'

import { getSiteUrl } from '@/lib/site'

const title = 'TechStore | Công nghệ chọn lọc'
const description =
  'Cửa hàng công nghệ hiện đại — laptop, điện thoại và phụ kiện chọn lọc. Dễ tìm, dễ so, dễ mua.'

/** Used by smoke tests and as the site name. */
export const appMetadata = {
  title,
  description,
} as const

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl()
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: '%s | TechStore',
    },
    description,
    applicationName: 'TechStore',
    authors: [{ name: 'TechStore' }],
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      siteName: 'TechStore',
      title,
      description,
      url: siteUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: '/',
    },
  }
}
