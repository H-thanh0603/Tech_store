import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { mapCatalogRowToCard } from '@/lib/catalog/queries'
import type { ProductCardData } from '@/lib/catalog/types'
import { parseCollectionFilters } from '@/lib/content/collection-filters'
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
import type { MenuHighlight } from '@/lib/content/nav-view'
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
  'id, slug, title, subtitle, collection_type, filters, homepage_collection_items ( product_id, sort_order )'

const PRODUCT_CARD_SELECT =
  'id, name, slug, category_slug, brand_name, min_price, has_discount, available_stock, image_url, image_alt'

const UI_ERROR = 'Failed to load homepage content'

interface CollectionRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  collection_type: string
  filters: unknown
  homepage_collection_items: Array<{ product_id: string; sort_order: number | string | null }> | null
}

function toCollectionType(value: string): CollectionType {
  return value === 'featured' || value === 'newest' || value === 'discounted' ? value : 'manual'
}

/** Curated product ids in display order. */
function orderedProductIds(row: CollectionRow): string[] {
  const items = (row.homepage_collection_items ?? []).map((item) => ({
    id: item.product_id,
    sort_order: item.sort_order,
  }))
  return sortByOrder(items).map((item) => item.id)
}

/** Hard ceiling on a dynamic rail, so one collection can never fetch the catalog. */
const DYNAMIC_COLLECTION_LIMIT = 12

/**
 * Products for a non-manual collection, resolved at request time.
 *
 * Each dynamic collection is one indexed query against `catalog_products` (RLS
 * keeps unpublished rows out) capped at 12 rows. They run in parallel with each
 * other, so a three-tab deal section costs three short queries, not a waterfall.
 */
async function fetchDynamicCollection(
  row: CollectionRow,
  type: Exclude<CollectionType, 'manual'>,
  supabase: SupabaseClient,
): Promise<ProductCardData[]> {
  const filters = parseCollectionFilters(row.filters)
  let query = supabase.from('catalog_products').select(PRODUCT_CARD_SELECT)

  if (filters.categorySlug) {
    query = query.eq('category_slug', filters.categorySlug)
  }
  if (filters.brandSlug) {
    query = query.eq('brand_slug', filters.brandSlug)
  }
  if (filters.useCase) {
    query = query.contains('use_cases', [filters.useCase])
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('min_price', filters.minPrice)
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('min_price', filters.maxPrice)
  }
  if (type === 'discounted') {
    query = query.eq('has_discount', true)
  }
  if (type === 'featured') {
    query = query.order('is_featured', { ascending: false })
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(DYNAMIC_COLLECTION_LIMIT)

  if (error) {
    console.error(`[content] failed to resolve ${type} collection "${row.slug}"`, error)
    return []
  }

  return (data ?? []).map((productRow) => mapCatalogRowToCard(productRow))
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
  const manualRows = rows.filter((row) => toCollectionType(row.collection_type) === 'manual')
  const dynamicRows = rows.filter((row) => toCollectionType(row.collection_type) !== 'manual')

  const idsByCollection = new Map(manualRows.map((row) => [row.id, orderedProductIds(row)]))
  const allProductIds = [...new Set([...idsByCollection.values()].flat())]

  // Curated products (one batch) and dynamic collections (one query each) start
  // together, so adding a dynamic rail does not lengthen the critical path.
  const [curatedResult, dynamicProducts] = await Promise.all([
    allProductIds.length > 0
      ? supabase.from('catalog_products').select(PRODUCT_CARD_SELECT).in('id', allProductIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(
      dynamicRows.map((row) =>
        fetchDynamicCollection(
          row,
          toCollectionType(row.collection_type) as Exclude<CollectionType, 'manual'>,
          supabase,
        ),
      ),
    ),
  ])

  if (curatedResult.error) {
    console.error('[content] failed to load collection products', curatedResult.error)
    throw new Error(UI_ERROR)
  }

  const cardsById = new Map<string, ProductCardData>(
    (curatedResult.data ?? []).map((row) => {
      const card = mapCatalogRowToCard(row)
      return [card.id, card]
    }),
  )

  const dynamicBySlug = new Map<string, ProductCardData[]>(
    dynamicRows.map((row, index) => [row.slug, dynamicProducts[index] ?? []]),
  )

  const bySlug = new Map<string, HomepageCollection>()
  for (const row of rows) {
    const type = toCollectionType(row.collection_type)
    const products =
      type === 'manual'
        ? reorderByIds([...cardsById.values()], idsByCollection.get(row.id) ?? [])
        : (dynamicBySlug.get(row.slug) ?? [])

    bySlug.set(row.slug, {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      type,
      products,
    })
  }
  return bySlug
}

/**
 * Collection slugs a section depends on, in config order.
 *
 * `product_collection` has one; `deal_tabs` has one per tab. Anything else has
 * none, which keeps the batch fetch below to exactly the slugs in use.
 */
function collectionSlugsOf(section: HomepageSection): string[] {
  if (section.type === 'product_collection') {
    const slug = section.config.collectionSlug
    return typeof slug === 'string' ? [slug] : []
  }
  if (section.type === 'deal_tabs') {
    const tabs = section.config.tabs
    if (!Array.isArray(tabs)) {
      return []
    }
    return tabs
      .map((tab) =>
        tab !== null && typeof tab === 'object'
          ? (tab as Record<string, unknown>).collectionSlug
          : undefined,
      )
      .filter((slug): slug is string => typeof slug === 'string')
  }
  return []
}

/**
 * Active homepage sections in display order, with `product_collection` and
 * `deal_tabs` sections resolved to real product cards.
 *
 * Cost is a fixed 3 round-trips regardless of how many sections exist: the
 * sections, the collections with their embedded items, then the product cards.
 * There is no per-section query, so adding sections never creates a waterfall.
 *
 * A section whose collections are all missing, hidden or empty is dropped: an
 * empty product rail — or a tab strip with nothing behind it — is worse than no
 * section at all.
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

  const slugs = [...new Set(sections.flatMap(collectionSlugsOf))]
  const collections = await fetchCollectionsBySlug(slugs, supabase)

  const resolved: HomepageSection[] = []
  for (const section of sections) {
    const wanted = collectionSlugsOf(section)
    if (wanted.length === 0) {
      resolved.push(section)
      continue
    }

    const limit = typeof section.config.limit === 'number' ? section.config.limit : undefined
    const available = wanted
      .map((slug) => collections.get(slug))
      .filter((collection): collection is HomepageCollection => Boolean(collection))
      .filter((collection) => collection.products.length > 0)
      .map((collection) => ({
        ...collection,
        products: limit === undefined ? collection.products : collection.products.slice(0, limit),
      }))

    if (available.length === 0) {
      console.warn(
        `[content] dropping section_key=${section.key}: no collection in [${wanted.join(', ')}] has products`,
      )
      continue
    }

    resolved.push({ ...section, collection: available[0], collections: available })
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

const MEGA_MENU_HIGHLIGHTS_PER_CATEGORY = 4

/** Same shape as PRODUCT_CARD_SELECT; kept local since CatalogRow is not exported. */
interface MegaMenuProductRow {
  id: string
  name: string
  slug: string
  category_slug: string
  brand_name: string | null
  min_price: number | string | null
  has_discount: boolean | null
  available_stock: number | string | null
  image_url: string | null
  image_alt: string | null
}

/**
 * Featured products for the mega menu (§3.4: "Sản phẩm nổi bật" per category
 * panel), grouped by category slug.
 *
 * One query, capped at a small multiple of the per-category limit and sliced
 * in JS: PostgREST cannot express "top N per group" directly, and the active
 * category count is small enough (~10) that this never approaches the row cap.
 * Cached like every other content query, so the header pays for it once per
 * request no matter how many components read it.
 */
async function loadMegaMenuHighlights(
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<Map<string, MenuHighlight[]>> {
  const { data, error } = await supabase
    .from('catalog_products')
    .select(PRODUCT_CARD_SELECT)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[content] failed to load mega menu highlights', error)
    return new Map()
  }

  const byCategory = new Map<string, MenuHighlight[]>()
  for (const row of (data ?? []) as MegaMenuProductRow[]) {
    const list = byCategory.get(row.category_slug) ?? []
    if (list.length >= MEGA_MENU_HIGHLIGHTS_PER_CATEGORY) {
      continue
    }
    const card = mapCatalogRowToCard(row)
    list.push({
      id: card.id,
      name: card.name,
      href: `/products/${card.slug}`,
      imageUrl: card.imageUrl,
      imageAlt: card.imageAlt,
      minPrice: card.minPrice,
    })
    byCategory.set(row.category_slug, list)
  }
  return byCategory
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
export const getMegaMenuHighlights = cache(loadMegaMenuHighlights)
