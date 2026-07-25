import { z } from 'zod'

import type { SectionConfig, SectionType } from '@/lib/content/types'

/**
 * Zod schemas for `homepage_sections.config` (JSONB), one per section_type.
 *
 * Database JSONB is untrusted input: it is only constrained to "an object under
 * 4KB". Every config is parsed here before it reaches a component, and every
 * schema is `.strict()` so an unknown key is rejected instead of flowing
 * through to the UI.
 */

/**
 * Mirrors the SQL function `content_is_safe_href` in
 * supabase/migrations/202607260015_content_foundation.sql. Keep both in sync.
 */
export const safeHref = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (href) =>
      !/\s/.test(href) &&
      !href.startsWith('//') &&
      (href.startsWith('/') || href.startsWith('https://')),
    { message: 'href must be a root-relative path or an https:// URL' },
  )

const emptyConfig = z.object({}).strict()

const heroConfig = z
  .object({
    bannerSlot: z.literal('home_hero').default('home_hero'),
    /** Side cards in the hero's right column (§4.1). */
    sideBannerSlot: z.literal('home_promo_grid').default('home_promo_grid'),
    sideLimit: z.number().int().min(0).max(3).default(3),
    ctaLabel: z.string().min(1).max(60).optional(),
    ctaHref: safeHref.optional(),
    showStats: z.boolean().default(false),
  })
  .strict()

const bannerGridConfig = z
  .object({
    bannerSlot: z.enum(['home_promo_grid', 'home_campaign_strip']),
    limit: z.number().int().min(1).max(6).default(3),
  })
  .strict()

const campaignLinksConfig = z
  .object({
    bannerSlot: z.literal('home_campaign_strip').default('home_campaign_strip'),
    limit: z.number().int().min(1).max(8).default(6),
  })
  .strict()

const categoryGridConfig = z
  .object({
    limit: z.number().int().min(4).max(12).default(8),
  })
  .strict()

const dealTabsConfig = z
  .object({
    tabs: z
      .array(
        z
          .object({
            label: z.string().min(1).max(40),
            collectionSlug: z.string().min(1).max(64),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    limit: z.number().int().min(4).max(12).default(8),
  })
  .strict()

const productCollectionConfig = z
  .object({
    collectionSlug: z.string().min(1).max(64),
    limit: z.number().int().min(1).max(12).default(8),
    layout: z.enum(['grid', 'rail']).default('grid'),
  })
  .strict()

/** Every SectionType must have an entry; the Record type enforces exhaustiveness. */
const SECTION_CONFIG_SCHEMAS: Record<SectionType, z.ZodType<Record<string, unknown>>> = {
  hero: heroConfig,
  banner_grid: bannerGridConfig,
  campaign_links: campaignLinksConfig,
  member_block: emptyConfig,
  category_mosaic: emptyConfig,
  category_grid: categoryGridConfig,
  deal_tabs: dealTabsConfig,
  product_collection: productCollectionConfig,
  need_selector: emptyConfig,
  brand_strip: emptyConfig,
  editorial: emptyConfig,
  trust: emptyConfig,
  guides: emptyConfig,
  newsletter: emptyConfig,
  flash_sale: emptyConfig,
  recently_viewed: emptyConfig,
}

export interface ParsedSectionConfig {
  /** Null when the config is unusable and the section must be dropped. */
  config: SectionConfig | null
  error: string | null
}

/**
 * Parse a raw JSONB config for a section type.
 *
 * Read path is lenient by design: a bad config degrades one section instead of
 * crashing the homepage. Sections whose schema has no required field fall back
 * to schema defaults; sections that need required input (product_collection)
 * are dropped.
 */
export function parseSectionConfig(type: SectionType, raw: unknown): ParsedSectionConfig {
  const schema = SECTION_CONFIG_SCHEMAS[type]
  const input = raw ?? {}
  const result = schema.safeParse(input)

  if (result.success) {
    return { config: result.data, error: null }
  }

  const error = result.error.issues.map((issue) => issue.message).join('; ')
  const fallback = schema.safeParse({})

  return { config: fallback.success ? fallback.data : null, error }
}
