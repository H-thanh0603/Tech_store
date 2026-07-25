import { HomePageView } from '@/components/home/home-page'
import { getProducts } from '@/lib/catalog/queries'
import { getActiveFlashOffers } from '@/lib/catalog/social'

export default async function HomePage() {
  const [featured, flashOffers] = await Promise.all([
    getProducts({ sort: 'relevance', page: 1 }),
    getActiveFlashOffers(6),
  ])

  return (
    <HomePageView
      featured={featured.products}
      total={featured.total}
      flashOffers={flashOffers}
    />
  )
}
