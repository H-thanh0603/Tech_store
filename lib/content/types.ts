import type { ProductCardData } from '@/lib/catalog/types'

/**
 * Storefront content DTOs (S1A).
 *
 * These are the shapes the storefront renders. They deliberately do not mirror
 * raw Supabase rows: snake_case, audit columns and scheduling windows stay in
 * the query layer so components never see database concerns.
 */

export const SECTION_TYPES = [
  'hero',
  'banner_grid',
  'campaign_links',
  'member_block',
  'category_mosaic',
  'category_grid',
  'deal_tabs',
  'product_collection',
  'need_selector',
  'brand_strip',
  'editorial',
  'trust',
  'guides',
  'newsletter',
  'flash_sale',
  'recently_viewed',
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export const BANNER_SLOTS = ['home_hero', 'home_promo_grid', 'home_campaign_strip'] as const

export type BannerSlot = (typeof BANNER_SLOTS)[number]

export const COLLECTION_TYPES = ['manual', 'featured', 'newest', 'discounted'] as const

export type CollectionType = (typeof COLLECTION_TYPES)[number]

export const NAV_ITEM_TYPES = ['link', 'category', 'group', 'promo'] as const

export type NavItemType = (typeof NAV_ITEM_TYPES)[number]

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && (SECTION_TYPES as readonly string[]).includes(value)
}

export function isBannerSlot(value: unknown): value is BannerSlot {
  return typeof value === 'string' && (BANNER_SLOTS as readonly string[]).includes(value)
}

export interface Banner {
  id: string
  name: string
  slot: BannerSlot
  title: string | null
  subtitle: string | null
  imageDesktopUrl: string | null
  imageMobileUrl: string | null
  href: string
  sortOrder: number
}

/** Parsed + defaulted section config. Shape depends on `type`; see config-schemas.ts. */
export type SectionConfig = Record<string, unknown>

export interface HomepageCollection {
  id: string
  slug: string
  title: string
  subtitle: string | null
  type: CollectionType
  products: ProductCardData[]
}

export interface HomepageSection {
  id: string
  key: string
  type: SectionType
  title: string | null
  subtitle: string | null
  eyebrow: string | null
  sortOrder: number
  config: SectionConfig
  /**
   * Resolved products for `product_collection` sections, batch-loaded by the
   * query layer so a renderer never fetches per section. Null for every other
   * section type.
   */
  collection: HomepageCollection | null
  /**
   * All collections this section references, in config order. A
   * `product_collection` has exactly one (the same object as `collection`); a
   * `deal_tabs` section has one per tab. Empty for every other type.
   */
  collections: HomepageCollection[]
}

export interface NavNode {
  id: string
  label: string
  href: string | null
  type: NavItemType
  iconKey: string | null
  imageUrl: string | null
  openInNewTab: boolean
  metadata: Record<string, unknown>
  children: NavNode[]
}
