import type { ReactNode } from 'react'

import { FlashSaleSection } from '@/components/commerce/flash-sale'
import { RecentlyViewedSection } from '@/components/commerce/recently-viewed'
import { BannerGridSection, CampaignLinksSection } from '@/components/home/sections/campaign-links'
import { CategoryGridSection } from '@/components/home/sections/category-grid'
import { DealTabsSection } from '@/components/home/sections/deal-tabs'
import {
  BrandStripSection,
  CategoryMosaicSection,
  EditorialSection,
  GuidesSection,
  NeedSelectorSection,
  NewsletterSection,
  TrustSection,
} from '@/components/home/sections/editorial-sections'
import { HeroCommerceSection } from '@/components/home/sections/hero-commerce'
import { MemberBlockSection } from '@/components/home/sections/member-block'
import { ProductCollectionSection } from '@/components/home/sections/product-collection'
import type { HomeSectionContext, SectionProps } from '@/components/home/sections/types'
import type { HomepageSection, SectionType } from '@/lib/content/types'

/**
 * Section registry: `homepage_sections.section_type` → renderer.
 *
 * The homepage renders whatever the database returns, in the order it returns it.
 * Two section types (`flash_sale`, `recently_viewed`) own their own data source
 * and render nothing when it is empty, so they take the context rather than the
 * section row.
 *
 * A type with no entry here cannot reach this point: the query layer drops rows
 * whose `section_type` this build does not know.
 */
const RENDERERS: Record<SectionType, (props: SectionProps) => ReactNode> = {
  hero: HeroCommerceSection,
  banner_grid: BannerGridSection,
  campaign_links: CampaignLinksSection,
  member_block: MemberBlockSection,
  category_mosaic: CategoryMosaicSection,
  category_grid: CategoryGridSection,
  deal_tabs: DealTabsSection,
  product_collection: ProductCollectionSection,
  need_selector: NeedSelectorSection,
  brand_strip: BrandStripSection,
  editorial: EditorialSection,
  trust: TrustSection,
  guides: GuidesSection,
  newsletter: NewsletterSection,
  flash_sale: ({ context }) => <FlashSaleSection offers={context.flashOffers} />,
  recently_viewed: () => <RecentlyViewedSection />,
}

export function renderSection(section: HomepageSection, context: HomeSectionContext) {
  const Renderer = RENDERERS[section.type]
  return <Renderer key={section.id} section={section} context={context} />
}

export const SECTION_RENDERER_KEYS = Object.keys(RENDERERS) as SectionType[]
