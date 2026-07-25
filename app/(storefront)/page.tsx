import { HomePageView } from '@/components/home/home-page'
import type { HomeSectionContext } from '@/components/home/sections/types'
import { getCatalogFacets, getProducts } from '@/lib/catalog/queries'
import { getActiveFlashOffers } from '@/lib/catalog/social'
import { buildHeaderNav, navigationFallback } from '@/lib/content/nav-view'
import { getActiveHomepageSections, getBannerSlot, getNavigationTree } from '@/lib/content/queries'
import { BANNER_SLOTS, type Banner, type BannerSlot } from '@/lib/content/types'

/**
 * Homepage data loader.
 *
 * Fetch shape is flat on purpose: sections, catalog facets, the first catalog
 * page, flash offers and navigation all start together, then the banner slots the
 * sections actually reference are fetched in a second parallel batch. No section
 * fetches anything itself, so the page cost does not grow with the number of
 * bands — only with the number of distinct banner slots in use.
 */

/** Banner slots a section might reference through its config. */
function bannerSlotsOf(config: Record<string, unknown>): BannerSlot[] {
  const candidates = [config.bannerSlot, config.sideBannerSlot]
  return candidates.filter((value): value is BannerSlot =>
    typeof value === 'string' && (BANNER_SLOTS as readonly string[]).includes(value),
  )
}

export default async function HomePage() {
  const [sections, facets, catalog, flashOffers, navigation] = await Promise.all([
    getActiveHomepageSections(),
    getCatalogFacets(),
    getProducts({ sort: 'relevance', page: 1 }),
    getActiveFlashOffers(6),
    getNavigationTree(),
  ])

  const slots = [...new Set(sections.flatMap((section) => bannerSlotsOf(section.config)))]
  const bannerLists = await Promise.all(slots.map((slot) => getBannerSlot(slot)))
  const bannersBySlot: Partial<Record<BannerSlot, Banner[]>> = {}
  slots.forEach((slot, index) => {
    bannersBySlot[slot] = bannerLists[index]
  })

  const nav = buildHeaderNav(
    navigation.length > 0 ? navigation : navigationFallback(),
    facets.brands,
  )

  const context: HomeSectionContext = {
    products: catalog.products,
    total: catalog.total,
    flashOffers,
    navEntries: nav.entries,
    brands: facets.brands,
    categories: facets.categories,
    bannersBySlot,
  }

  return <HomePageView sections={sections} context={context} />
}
