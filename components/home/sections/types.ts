import type { FlashOfferCard } from '@/lib/catalog/social'
import type { ProductCardData } from '@/lib/catalog/types'
import type { FacetOption, MenuEntry } from '@/lib/content/nav-view'
import type { Banner, BannerSlot, HomepageSection } from '@/lib/content/types'

/**
 * Everything a homepage section may need, fetched once per request by the page
 * and passed down. Sections are pure renderers: none of them queries.
 */
export interface HomeSectionContext {
  /** First page of the catalog — used for hero visuals and as a copy fallback. */
  products: ProductCardData[]
  /** Total published products, for the hero stat row. */
  total: number
  flashOffers: FlashOfferCard[]
  /** Header navigation entries, reused by the hero's category rail. */
  navEntries: MenuEntry[]
  brands: FacetOption[]
  categories: FacetOption[]
  /** Banners grouped by slot; a missing slot means "nothing scheduled". */
  bannersBySlot: Partial<Record<BannerSlot, Banner[]>>
}

/** Props every section renderer receives. */
export interface SectionProps {
  section: HomepageSection
  context: HomeSectionContext
}

/** Copy that comes from the `homepage_sections` row rather than the component. */
export interface SectionCopy {
  eyebrow: string | null
  title: string | null
  subtitle: string | null
}

/** Reads a banner slot from the context, honouring a config limit. */
export function bannersFor(
  context: HomeSectionContext,
  slot: unknown,
  limit?: unknown,
): Banner[] {
  if (typeof slot !== 'string') {
    return []
  }
  const banners = context.bannersBySlot[slot as BannerSlot] ?? []
  return typeof limit === 'number' ? banners.slice(0, limit) : banners
}
