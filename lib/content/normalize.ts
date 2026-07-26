import { parseSectionConfig } from '@/lib/content/config-schemas'
import {
  isBannerSlot,
  isSectionType,
  type Banner,
  type HomepageSection,
  type NavItemType,
  type NavNode,
} from '@/lib/content/types'

/**
 * Pure normalizers for storefront content rows.
 *
 * Everything here is side-effect free and takes `now` as a parameter so tests
 * are deterministic. RLS already filters inactive/out-of-window rows; these
 * helpers are the second tier that also protects callers using a service-role
 * client (admin preview) and guards against clock skew between DB and app.
 */

export interface BannerRow {
  id: string
  name: string
  slot: string
  title: string | null
  subtitle: string | null
  image_desktop_url: string | null
  image_mobile_url: string | null
  href: string
  sort_order: number | string | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean | null
}

export interface SectionRow {
  id: string
  section_key: string
  section_type: string
  title: string | null
  subtitle: string | null
  eyebrow: string | null
  config: unknown
  sort_order: number | string | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean | null
}

export interface NavigationRow {
  id: string
  parent_id: string | null
  label: string
  href: string | null
  item_type: string
  icon_key: string | null
  image_url: string | null
  metadata: unknown
  sort_order: number | string | null
  open_in_new_tab: boolean | null
  is_active?: boolean | null
}

const NAV_ITEM_TYPE_FALLBACK: NavItemType = 'link'
const MAX_NAV_DEPTH = 3

/** PostgREST returns integers as numbers, but be defensive about numeric-as-string. */
export function toOrder(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toTime(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Scheduling window check. `starts_at` is inclusive, `ends_at` is exclusive —
 * the same semantics as the SQL helper `content_is_visible` and the existing
 * `flash_offers` policy.
 */
export function isVisibleNow(
  row: { starts_at?: string | null; ends_at?: string | null; is_active?: boolean | null },
  now: Date = new Date(),
): boolean {
  if (row.is_active === false) {
    return false
  }
  const at = now.getTime()
  const startsAt = toTime(row.starts_at)
  const endsAt = toTime(row.ends_at)

  if (startsAt !== null && startsAt > at) {
    return false
  }
  if (endsAt !== null && endsAt <= at) {
    return false
  }
  return true
}

/**
 * Stable ascending sort by `sort_order` then `id`, mirroring the SQL
 * `order by sort_order, id`. Returns a new array; the input is never mutated.
 */
export function sortByOrder<T extends { id: string; sort_order?: number | string | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const delta = toOrder(a.sort_order) - toOrder(b.sort_order)
    return delta !== 0 ? delta : a.id.localeCompare(b.id)
  })
}

/** Returns null when the row carries a slot the app does not know about. */
export function mapBannerRow(row: BannerRow): Banner | null {
  if (!isBannerSlot(row.slot)) {
    return null
  }
  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    title: row.title,
    subtitle: row.subtitle,
    imageDesktopUrl: row.image_desktop_url,
    imageMobileUrl: row.image_mobile_url,
    href: row.href,
    sortOrder: toOrder(row.sort_order),
  }
}

export interface MappedSection {
  section: HomepageSection | null
  /** Set when the row was dropped or its config fell back to defaults. */
  warning: string | null
}

/**
 * Map a section row to a DTO. A row is dropped (section === null) when its
 * `section_type` is not renderable by this build, or when its config cannot be
 * repaired. One bad row must never break the rest of the page.
 */
export function mapSectionRow(row: SectionRow): MappedSection {
  if (!isSectionType(row.section_type)) {
    return {
      section: null,
      warning: `unknown section_type "${row.section_type}" (section_key=${row.section_key})`,
    }
  }

  const parsed = parseSectionConfig(row.section_type, row.config)
  if (parsed.config === null) {
    return {
      section: null,
      warning: `invalid config for section_key=${row.section_key}: ${parsed.error ?? 'unknown'}`,
    }
  }

  return {
    section: {
      id: row.id,
      key: row.section_key,
      type: row.section_type,
      title: row.title,
      subtitle: row.subtitle,
      eyebrow: row.eyebrow,
      sortOrder: toOrder(row.sort_order),
      config: parsed.config,
      collection: null,
      collections: [],
    },
    warning: parsed.error ? `config fallback for section_key=${row.section_key}: ${parsed.error}` : null,
  }
}

function toMetadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toNavItemType(value: string): NavItemType {
  switch (value) {
    case 'link':
    case 'category':
    case 'group':
    case 'promo':
      return value
    default:
      return NAV_ITEM_TYPE_FALLBACK
  }
}

/**
 * Build the navigation tree from a flat row list.
 *
 * Rows whose `parent_id` does not resolve to a visible row are dropped
 * (orphans stay out of the menu rather than being promoted to top level), and
 * anything deeper than 3 levels is trimmed. A `parent_id` cycle — which the DB
 * trigger already rejects — cannot produce infinite recursion here because
 * only nodes reachable from a null parent are emitted.
 */
export function buildNavigationTree(rows: readonly NavigationRow[]): NavNode[] {
  const visible = rows.filter((row) => row.is_active !== false)
  const childrenByParent = new Map<string, NavigationRow[]>()

  for (const row of visible) {
    const key = row.parent_id ?? ''
    const bucket = childrenByParent.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      childrenByParent.set(key, [row])
    }
  }

  const build = (parentKey: string, depth: number): NavNode[] => {
    if (depth > MAX_NAV_DEPTH) {
      return []
    }
    return sortByOrder(childrenByParent.get(parentKey) ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      href: row.href,
      type: toNavItemType(row.item_type),
      iconKey: row.icon_key,
      imageUrl: row.image_url,
      openInNewTab: row.open_in_new_tab === true,
      metadata: toMetadata(row.metadata),
      children: build(row.id, depth + 1),
    }))
  }

  return build('', 1)
}

/**
 * Reorder items to match a list of ids, dropping ids with no match. Used to
 * restore curated collection order after a bulk `.in('id', ids)` fetch, since
 * PostgREST does not preserve the order of the `in` list.
 */
export function reorderByIds<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item) {
      ordered.push(item)
    }
  }
  return ordered
}
