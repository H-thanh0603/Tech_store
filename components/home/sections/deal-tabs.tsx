'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { ProductCard } from '@/components/commerce/product-card'
import type { SectionProps } from '@/components/home/sections/types'
import { SectionHeader } from '@/components/ui/section-header'
import { buildCatalogQuery } from '@/lib/catalog/search-params'
import type { ProductCardData } from '@/lib/catalog/types'
import type { HomepageCollection, HomepageSection } from '@/lib/content/types'

/**
 * Deal / discovery tabs (§4.4).
 *
 * Every tab arrives with the page (one batched query in the content layer), so
 * switching tabs is instant and costs no request. The category chips filter the
 * products already on screen — they never fabricate a count and never hit the
 * network.
 *
 * There is deliberately no countdown here: a timer is only honest when a real end
 * date exists, and that case is already served by the `flash_sale` section which
 * reads `flash_offers.ends_at`.
 *
 * Accessibility: real tablist/tab/tabpanel roles, ArrowLeft/ArrowRight move
 * between tabs, Home/End jump to the ends, and only the active tab is tabbable.
 */
export function DealTabsSection({ section }: SectionProps) {
  const collections = section.collections
  const [activeIndex, setActiveIndex] = useState(0)
  const [category, setCategory] = useState<string | null>(null)
  const tabRefs = useRef(new Map<number, HTMLButtonElement>())

  const tabLabels = useMemo(() => tabLabelsFor(section, collections), [section, collections])
  const active = collections[activeIndex] ?? collections[0]
  const chips = useMemo(() => categoryChips(active?.products ?? []), [active])
  const products = useMemo(() => {
    const list = active?.products ?? []
    return category ? list.filter((product) => product.categorySlug === category) : list
  }, [active, category])

  if (!active) {
    return null
  }

  function selectTab(index: number) {
    setActiveIndex(index)
    setCategory(null)
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = collections.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight') {
      next = index === last ? 0 : index + 1
    } else if (event.key === 'ArrowLeft') {
      next = index === 0 ? last : index - 1
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = last
    }
    if (next !== null) {
      event.preventDefault()
      selectTab(next)
      tabRefs.current.get(next)?.focus()
    }
  }

  return (
    <section
      aria-labelledby="deals-heading"
      className="section-y border-b border-border bg-bg-secondary/50"
    >
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Deal và hàng mới'}
          description={section.subtitle ?? undefined}
          titleId="deals-heading"
          actionHref="/products"
          actionLabel="Xem catalog"
        />

        <div role="tablist" aria-label="Nhóm ưu đãi" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {collections.map((collection, index) => {
            const selected = index === activeIndex
            return (
              <button
                key={collection.slug}
                ref={(node) => {
                  if (node) {
                    tabRefs.current.set(index, node)
                  } else {
                    tabRefs.current.delete(index)
                  }
                }}
                type="button"
                role="tab"
                id={`deal-tab-${collection.slug}`}
                aria-selected={selected}
                aria-controls={`deal-panel-${collection.slug}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(index)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-(--radius-md) px-4 text-(length:--text-sm) font-semibold transition-colors ${
                  selected
                    ? 'bg-brand text-accent-fg'
                    : 'border border-border bg-bg-elevated text-fg-muted hover:border-brand hover:text-brand'
                }`}
              >
                {tabLabels[index]}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`deal-panel-${active.slug}`}
          aria-labelledby={`deal-tab-${active.slug}`}
          className="mt-5"
        >
          {active.subtitle ? (
            <p className="mb-4 text-(length:--text-sm) text-fg-muted">{active.subtitle}</p>
          ) : null}

          {chips.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <FilterChip active={category === null} onClick={() => setCategory(null)}>
                Tất cả ({active.products.length})
              </FilterChip>
              {chips.map((chip) => (
                <FilterChip
                  key={chip.slug}
                  active={category === chip.slug}
                  onClick={() => setCategory(chip.slug)}
                >
                  {chip.label} ({chip.count})
                </FilterChip>
              ))}
            </div>
          ) : null}

          {products.length > 0 ? (
            <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <li key={product.id} className="flex w-64 shrink-0 snap-start sm:w-auto">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-(--radius-lg) border border-border bg-bg-elevated p-6 text-(length:--text-sm) text-fg-muted">
              Không có sản phẩm nào trong nhóm này.
            </p>
          )}

          {category ? (
            <Link
              href={`/products${buildCatalogQuery({ category })}`}
              className="mt-4 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-brand hover:underline"
            >
              Xem tất cả sản phẩm trong danh mục này →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** Tab labels come from config when set, otherwise from the collection title. */
function tabLabelsFor(section: HomepageSection, collections: HomepageCollection[]): string[] {
  const configured = Array.isArray(section.config.tabs)
    ? (section.config.tabs as Array<Record<string, unknown>>)
    : []
  return collections.map((collection) => {
    const match = configured.find((tab) => tab.collectionSlug === collection.slug)
    return typeof match?.label === 'string' ? match.label : collection.title
  })
}

function categoryChips(
  products: ProductCardData[],
): Array<{ slug: string; label: string; count: number }> {
  const counts = new Map<string, number>()
  for (const product of products) {
    counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, label: labelFromSlug(slug), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/**
 * Display name from a category slug. The product card DTO carries the slug only,
 * and widening the query just to label a chip is not worth the extra join.
 */
function labelFromSlug(slug: string): string {
  const words = slug.split('-').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center rounded-full px-3 text-(length:--text-xs) font-medium transition-colors ${
        active
          ? 'bg-surface-inverse text-fg-inverse'
          : 'border border-border bg-bg-elevated text-fg-muted hover:border-brand hover:text-brand'
      }`}
    >
      {children}
    </button>
  )
}
