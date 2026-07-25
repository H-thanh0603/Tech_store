import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { mapCatalogRowToCard } from '@/lib/catalog/queries'
import type { ProductCardData } from '@/lib/catalog/types'
import {
  buildNavigationTree,
  mapBannerRow,
  mapSectionRow,
  reorderByIds,
  sortByOrder,
  type BannerRow,
  type NavigationRow,
  type SectionRow,
} from '@/lib/content/normalize'
import {
  isBannerSlot,
  type Banner,
  type BannerSlot,
  type CollectionType,
  type HomepageCollection,
  type HomepageSection,
  type NavNode,
} from '@/lib/content/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Server-only query layer for storefront content (S1A).
 *
 * Components never touch Supabase directly: they call these functions and get
 * plain DTOs. Each function takes an injectable client so tests can pass a mock,
 * and is wrapped in React `cache()` so two components asking for the same data
 * in one request share a single round-trip.
 *
 * Raw Postgres errors are logged server-side and never surfaced to the UI.
 */

const BANNER_SELECT =
  'id, name, slot, title, subtitle, image_desktop_url, image_mobile_url, href, sort_order'

const SECTION_SELECT = 'id, section_key, section_type, title, subtitle, eyebrow, config, sort_order'

// Items are embedded rather than fetched separately: PostgREST applies the
// child table's RLS policy to the embedded rows, so unpublished or archived
// products stay hidden and the whole collection set costs one round-trip.
const COLLECTION_SELECT =
  'id, slug, title, subtitle, collection_type, homepage_collection_items ( product_id, sort_order )'

const PRODUCT_CARD_SELECT =
  'id, name, slug, category_slug, brand_name, min_price, has_discount, available_stock, image_url, image_alt'

const UI_ERROR = 'Failed to load homepage content'

interface CollectionRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  collection_type: string
  homepage_collection_items: Array<{ product_id: string; sort_order: number | string | null }> | null
}

function toCollectionType(value: string): CollectionType {
  return value === 'featured' || value === 'newest' ? value : 'manual'
}

/** Curated product ids in display order. */
function orderedProductIds(row: CollectionRow): string[] {
  const items = (row.homepage_collection_items ?? []).map((item) => ({
    id: item.product_id,
    sort_order: item.sort_order,
  }))
  return sortByOrder(items).map((item) => item.id)
}

/**
 * Load collections by slug plus their product cards, keyed by slug.
 *
 * Two round-trips regardless of how many slugs are requested: the collections
 * with their embedded items, then one batch fetch of the product cards.
 */
async function fetchCollectionsBySlug(
  slugs: readonly string[],
  supabase: SupabaseClient,
): Promise<Map<string, HomepageCollection>> {
  if (slugs.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase.from('homepage_collections').select(COLLECTION_SELECT).in('slug', slugs)

  if (error) {
    console.error('[content] failed to load homepage collections', error)
    throw new Error(UI_ERROR)
  }

  const rows = (data ?? []) as CollectionRow[]
  const idsByCollection = new Map(rows.map((row) => [row.id, orderedProductIds(row)]))
  const allProductIds = [...new Set([...idsByCollection.values()].flat())]

  let cardsById = new Map<string, ProductCardData>()
  if (allProductIds.length > 0) {
    const { data: productData, error: productError } = await supabase
      .from('catalog_products')
      .select(PRODUCT_CARD_SELECT)
      .in('id', allProductIds)

    if (productError) {
      console.error('[content] failed to load collection products', productError)
      throw new Error(UI_ERROR)
    }

    cardsById = new Map(
      (productData ?? []).map((row) => {
        const card = mapCatalogRowToCard(row)
        return [card.id, card]
      }),
    )
  }

  const bySlug = new Map<string, HomepageCollection>()
  for (const row of rows) {
    const ids = idsByCollection.get(row.id) ?? []
    bySlug.set(row.slug, {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      type: toCollectionType(row.collection_type),
      products: reorderByIds([...cardsById.values()], ids),
    })
  }
  return bySlug
}

/**
 * Active homepage sections in display order, with `product_collection` sections
 * resolved to real product cards.
 *
 * Cost is a fixed 3 round-trips regardless of how many sections exist: the
 * sections, the collections with their embedded items, then the product cards.
 * There is no per-section query, so adding sections never creates a waterfall.
 *
 * A `product_collection` section whose collection is missing, hidden or empty is
 * dropped: an empty product rail is worse than no rail.
 */
async function loadActiveHomepageSections(
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<HomepageSection[]> {
  const { data, error } = await supabase
    .from('homepage_sections')
    .select(SECTION_SELECT)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('[content] failed to load homepage sections', error)
    throw new Error(UI_ERROR)
  }

  const sections: HomepageSection[] = []
  for (const row of sortByOrder((data ?? []) as SectionRow[])) {
    const mapped = mapSectionRow(row)
    if (mapped.warning) {
      console.warn(`[content] ${mapped.warning}`)
    }
    if (mapped.section) {
      sections.push(mapped.section)
    }
  }

  const slugs = [
    ...new Set(
      sections
        .filter((section) => section.type === 'product_collection')
        .map((section) => section.config.collectionSlug)
        .filter((slug): slug is string => typeof slug === 'string'),
    ),
  ]
  const collections = await fetchCollectionsBySlug(slugs, supabase)

  const resolved: HomepageSection[] = []
  for (const section of sections) {
    if (section.type !== 'product_collection') {
      resolved.push(section)
      continue
    }

    const slug = section.config.collectionSlug
    const collection = typeof slug === 'string' ? collections.get(slug) : undefined
    if (!collection || collection.products.length === 0) {
      console.warn(`[content] dropping section_key=${section.key}: collection "${String(slug)}" has no products`)
      continue
    }

    const limit = typeof section.config.limit === 'number' ? section.config.limit : collection.products.length
    resolved.push({
      ...section,
      collection: { ...collection, products: collection.products.slice(0, limit) },
    })
  }

  return resolved
}

/** Banners for one slot, already filtered by RLS to active + in-window rows. */
async function loadBannerSlot(
  slot: BannerSlot,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<Banner[]> {
  if (!isBannerSlot(slot)) {
    return []
  }

  const { data, error } = await supabase
    .from('banners')
    .select(BANNER_SELECT)
    .eq('slot', slot)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    // A missing banner degrades the page; it should not break it.
    console.error('[content] failed to load banners', error)
    return []
  }

  const banners: Banner[] = []
  for (const row of sortByOrder((data ?? []) as BannerRow[])) {
    const banner = mapBannerRow(row)
    if (banner) {
      banners.push(banner)
    }
  }
  return banners
}

/**
 * One curated collection with its product cards, or null when the slug does not
 * resolve to a visible collection.
 *
 * Products that are unpublished or archived are already excluded by the RLS
 * policy on `homepage_collection_items`, so a curated list can never leak a
 * product the catalog itself would hide.
 */
async function loadHomepageCollection(
  slug: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<HomepageCollection | null> {
  const collections = await fetchCollectionsBySlug([slug], supabase)
  return collections.get(slug) ?? null
}

/**
 * Navigation tree (max 3 levels).
 *
 * `category` items are cross-checked against the live category list: an item
 * pointing at a category that was deactivated or deleted is dropped rather than
 * rendering a dead menu entry.
 */
async function loadNavigationTree(
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<NavNode[]> {
  const [navResult, categoryResult] = await Promise.all([
    supabase
      .from('navigation_items')
      .select(
        'id, parent_id, label, href, item_type, icon_key, image_url, metadata, sort_order, open_in_new_tab',
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase.from('categories').select('slug').eq('is_active', true),
  ])

  if (navResult.error) {
    console.error('[content] failed to load navigation', navResult.error)
    return []
  }
  if (categoryResult.error) {
    console.error('[content] failed to load categories for navigation', categoryResult.error)
    return []
  }

  const activeSlugs = new Set(
    ((categoryResult.data ?? []) as Array<{ slug: string }>).map((row) => row.slug),
  )

  const rows = ((navResult.data ?? []) as NavigationRow[]).filter((row) => {
    if (row.item_type !== 'category') {
      return true
    }
    const metadata = row.metadata
    const categorySlug =
      metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>).categorySlug
        : undefined
    return typeof categorySlug === 'string' && activeSlugs.has(categorySlug)
  })

  return buildNavigationTree(rows)
}

export const getActiveHomepageSections = cache(loadActiveHomepageSections)
export const getBannerSlot = cache(loadBannerSlot)
export const getHomepageCollection = cache(loadHomepageCollection)
export const getNavigationTree = cache(loadNavigationTree)
