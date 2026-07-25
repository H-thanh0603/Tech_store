import { HomePageView } from '@/components/home/home-page'
import { getProducts } from '@/lib/catalog/queries'

export default async function HomePage() {
  const featured = await getProducts({ sort: 'relevance', page: 1 })

  return (
    <HomePageView featured={featured.products} total={featured.total} />
  )
}
