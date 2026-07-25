import Link from 'next/link'

import { ScrollReveal } from '@/components/home/scroll-reveal'
import type { SectionProps } from '@/components/home/sections/types'
import { SectionHeader } from '@/components/ui/section-header'
import {
  IconGrid,
  IconHeadphones,
  IconKeyboard,
  IconLaptop,
  IconMonitor,
  IconSmartphone,
} from '@/components/ui/icons'
import { buildCatalogQuery } from '@/lib/catalog/search-params'

/**
 * Category shortcut grid (§4.5).
 *
 * Cards come from the live `categories` table, so a category that is deactivated
 * in admin disappears here without a deploy. Icons are matched by slug with a
 * neutral fallback — a new category renders correctly on day one.
 */

const ICON_BY_SLUG: Record<string, typeof IconGrid> = {
  laptop: IconLaptop,
  'dien-thoai': IconSmartphone,
  tablet: IconSmartphone,
  'phu-kien': IconHeadphones,
  'am-thanh': IconHeadphones,
  'man-hinh': IconMonitor,
  pc: IconMonitor,
  'ban-phim': IconKeyboard,
  chuot: IconKeyboard,
}

export function CategoryGridSection({ section, context }: SectionProps) {
  const limit = typeof section.config.limit === 'number' ? section.config.limit : 8
  const categories = context.categories.slice(0, limit)

  if (categories.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="category-grid-heading" className="section-y border-b border-border">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Mua theo danh mục'}
          description={section.subtitle ?? undefined}
          titleId="category-grid-heading"
          actionHref="/products"
          actionLabel="Tất cả sản phẩm"
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((category, index) => {
            const Icon = ICON_BY_SLUG[category.slug] ?? IconGrid
            return (
              <li key={category.slug}>
                <ScrollReveal delayMs={(index % 5) * 40}>
                  <Link
                    href={`/products${buildCatalogQuery({ category: category.slug })}`}
                    className="reveal-soft flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-(--radius-lg) border border-border bg-bg-elevated p-4 text-center shadow-(--shadow-sm)"
                  >
                    <span
                      aria-hidden
                      className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand"
                    >
                      <Icon size={22} />
                    </span>
                    <span className="text-(length:--text-sm) font-semibold text-fg">
                      {category.name}
                    </span>
                  </Link>
                </ScrollReveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
