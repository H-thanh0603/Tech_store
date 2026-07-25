import { buildCatalogQuery } from '@/lib/catalog/search-params'
import type { CatalogFilters } from '@/lib/catalog/types'
import { CATEGORY_NAV, QUICK_LINKS } from '@/lib/customer/categories'
import type { NavNode } from '@/lib/content/types'

/**
 * Header navigation view model (S1).
 *
 * Pure transform: CMS `navigation_items` + catalog facets in, render-ready
 * columns out. No DB access and no React here, so the mega-menu shape is unit
 * testable and the client bundle only receives plain data.
 *
 * Every href is built from `buildCatalogQuery`, which means a menu link is
 * always a filter the catalog page can actually parse — no dead links.
 */

export interface MenuLink {
  label: string
  href: string
  /** Optional short hint, e.g. a price band description. */
  hint?: string
}

/** Structural shape of a catalog facet (categories/brands) — no DB coupling. */
export interface FacetOption {
  name: string
  slug: string
}

export interface MenuColumn {
  id: string
  title: string
  links: MenuLink[]
}

export interface MenuPromo {
  title: string
  body: string
  href: string
  ctaLabel: string
}

export interface MegaPanel {
  /** Product groups: children of the nav entry, grouped by their own children. */
  groups: MenuColumn[]
  brands: MenuLink[]
  needs: MenuLink[]
  priceBands: MenuLink[]
  promo: MenuPromo
}

export interface MenuEntry {
  id: string
  label: string
  href: string
  iconKey: string | null
  /** Null for flat entries (a plain link with no panel). */
  panel: MegaPanel | null
}

export interface HeaderNavView {
  entries: MenuEntry[]
  quickLinks: MenuLink[]
}

/** Use-case filters that exist in the catalog (`products.use_cases`). */
export const USE_CASE_FILTERS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'hoc-tap', label: 'Học tập' },
  { slug: 'van-phong', label: 'Văn phòng' },
  { slug: 'lap-trinh', label: 'Lập trình' },
  { slug: 'sang-tao', label: 'Sáng tạo' },
  { slug: 'gaming', label: 'Gaming' },
  { slug: 'di-chuyen', label: 'Di chuyển nhiều' },
]

const MILLION = 1_000_000

/** Price bands in VND. `min`/`max` are inclusive/exclusive respectively. */
const PRICE_BANDS: ReadonlyArray<{ label: string; min?: number; max?: number }> = [
  { label: 'Dưới 5 triệu', max: 5 * MILLION },
  { label: '5 – 10 triệu', min: 5 * MILLION, max: 10 * MILLION },
  { label: '10 – 20 triệu', min: 10 * MILLION, max: 20 * MILLION },
  { label: '20 – 30 triệu', min: 20 * MILLION, max: 30 * MILLION },
  { label: 'Trên 30 triệu', min: 30 * MILLION },
]

const MAX_BRANDS_IN_PANEL = 8

function categorySlugOf(node: NavNode): string | undefined {
  const value = node.metadata.categorySlug
  return typeof value === 'string' ? value : undefined
}

function catalogHref(filters: CatalogFilters): string {
  return `/products${buildCatalogQuery(filters)}`
}

function toGroups(node: NavNode): MenuColumn[] {
  const columns: MenuColumn[] = []
  const flat: MenuLink[] = []

  for (const child of node.children) {
    if (child.children.length > 0) {
      columns.push({
        id: child.id,
        title: child.label,
        links: child.children
          .filter((leaf) => Boolean(leaf.href))
          .map((leaf) => ({ label: leaf.label, href: leaf.href as string })),
      })
      continue
    }
    if (child.href) {
      flat.push({ label: child.label, href: child.href })
    }
  }

  if (flat.length > 0) {
    columns.unshift({ id: `${node.id}-groups`, title: 'Nhóm sản phẩm', links: flat })
  }
  return columns
}

function toPriceBands(categorySlug: string | undefined): MenuLink[] {
  return PRICE_BANDS.map((band) => ({
    label: band.label,
    href: catalogHref({ category: categorySlug, minPrice: band.min, maxPrice: band.max }),
  }))
}

function toNeeds(categorySlug: string | undefined): MenuLink[] {
  return USE_CASE_FILTERS.map((useCase) => ({
    label: useCase.label,
    href: catalogHref({ category: categorySlug, useCase: useCase.slug }),
  }))
}

/**
 * Brand links are intentionally not scoped to the open category: a brand that
 * sells nothing in that category would render a link to an empty result set.
 */
function toBrands(brands: readonly FacetOption[]): MenuLink[] {
  return brands
    .slice(0, MAX_BRANDS_IN_PANEL)
    .map((brand) => ({ label: brand.name, href: catalogHref({ brand: brand.slug }) }))
}

function toPromo(node: NavNode, categorySlug: string | undefined): MenuPromo {
  return {
    title: `Đang có hàng: ${node.label}`,
    body: 'Giá VND và tồn kho lấy trực tiếp từ kho — không countdown giả.',
    href: node.href ?? catalogHref({ category: categorySlug, inStock: true }),
    ctaLabel: `Vào ${node.label}`,
  }
}

/**
 * Drops repeated hrefs across a panel's groups (first occurrence wins) and
 * removes groups left empty. Without this, a CMS child like "Tất cả laptop"
 * would collide with the generated "all" shortcut.
 */
function dedupeGroups(groups: MenuColumn[]): MenuColumn[] {
  const seen = new Set<string>()
  const result: MenuColumn[] = []

  for (const group of groups) {
    const links = group.links.filter((link) => {
      if (seen.has(link.href)) {
        return false
      }
      seen.add(link.href)
      return true
    })
    if (links.length > 0) {
      result.push({ ...group, links })
    }
  }
  return result
}

/**
 * Build the header view model.
 *
 * An entry gets a mega panel when it has children; otherwise it stays a plain
 * link (e.g. "Tra cứu đơn"), which keeps the menu honest about what is behind it.
 */
export function buildHeaderNav(
  navigation: readonly NavNode[],
  brands: readonly FacetOption[],
): HeaderNavView {
  const entries: MenuEntry[] = navigation.map((node) => {
    const categorySlug = categorySlugOf(node)
    const href = node.href ?? catalogHref({ category: categorySlug })
    const hasPanel = node.children.length > 0

    return {
      id: node.id,
      label: node.label,
      href,
      iconKey: node.iconKey,
      panel: hasPanel
        ? {
            groups: dedupeGroups([
              {
                id: `${node.id}-all`,
                title: node.label,
                links: [{ label: `Tất cả ${node.label.toLowerCase()}`, href }],
              },
              ...toGroups(node),
            ]),
            brands: toBrands(brands),
            needs: toNeeds(categorySlug),
            priceBands: toPriceBands(categorySlug),
            promo: toPromo(node, categorySlug),
          }
        : null,
    }
  })

  return { entries, quickLinks: [...QUICK_LINKS] }
}

/**
 * Static fallback used when `navigation_items` is empty or unreachable, so the
 * header never collapses to a bare logo. Mirrors the CMS shape.
 */
export function navigationFallback(): NavNode[] {
  return CATEGORY_NAV.map((item, index) => ({
    id: `fallback-${item.slug}`,
    label: item.label,
    href: item.href,
    type: 'category' as const,
    iconKey: null,
    imageUrl: null,
    openInNewTab: false,
    metadata: { categorySlug: item.slug, sortOrder: index },
    children: (item.children ?? []).map((child) => ({
      id: `fallback-${item.slug}-${child.slug}`,
      label: child.label,
      href: child.href,
      type: 'link' as const,
      iconKey: null,
      imageUrl: null,
      openInNewTab: false,
      metadata: {},
      children: [],
    })),
  }))
}
