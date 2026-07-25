import Link from 'next/link'

import { ScrollReveal } from '@/components/home/scroll-reveal'
import type { SectionProps } from '@/components/home/sections/types'
import { SectionHeader } from '@/components/ui/section-header'
import { buildCatalogQuery } from '@/lib/catalog/search-params'
import {
  CATEGORY_EXPLORER,
  GUIDE_LINKS,
  needSelectorItems,
  TRUST_ITEMS,
} from '@/lib/catalog/highlights'

/**
 * Sections whose content is editorial rather than catalog data.
 *
 * Copy (eyebrow/title/subtitle) still comes from the `homepage_sections` row, so
 * an editor can retitle or reorder them; only the inner items — use cases, trust
 * promises, guide links — remain in code, because each one maps to a concrete
 * catalog filter and would break if it were free text.
 */

export function CategoryMosaicSection({ section }: SectionProps) {
  return (
    <section aria-labelledby="mosaic-heading" className="section-y border-b border-border">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Mua theo danh mục'}
          description={section.subtitle ?? undefined}
          titleId="mosaic-heading"
          actionHref="/products"
          actionLabel="Tất cả sản phẩm"
        />
        <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {CATEGORY_EXPLORER.map((category, index) => (
            <li key={category.href + category.label} className={category.span}>
              <ScrollReveal delayMs={index * 40}>
                <Link
                  href={category.href}
                  className="reveal-soft flex h-full min-h-36 flex-col justify-end overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                >
                  <span
                    className="mb-auto inline-flex size-10 items-center justify-center rounded-(--radius-md) bg-brand-soft text-(length:--text-sm) font-bold text-brand"
                    aria-hidden
                  >
                    {category.label.slice(0, 1)}
                  </span>
                  <p className="text-(length:--text-xl) font-semibold tracking-tight text-fg">
                    {category.label}
                  </p>
                  <p className="mt-1 text-(length:--text-sm) text-fg-muted">{category.blurb}</p>
                </Link>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function NeedSelectorSection({ section }: SectionProps) {
  const needs = needSelectorItems()

  return (
    <section id="need-selector" aria-labelledby="need-heading" className="section-y bg-bg-secondary/70">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Chọn nhu cầu, chúng tôi gợi ý thiết bị'}
          description={section.subtitle ?? undefined}
          titleId="need-heading"
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {needs.map((need, index) => (
            <li key={need.id}>
              <ScrollReveal delayMs={(index % 4) * 50}>
                <Link
                  href={need.href}
                  className="reveal-soft flex h-full flex-col rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                >
                  <p className="text-(length:--text-base) font-semibold text-fg">{need.label}</p>
                  <p className="mt-2 flex-1 text-(length:--text-sm) leading-relaxed text-fg-muted">
                    {need.blurb}
                  </p>
                  <span className="mt-4 flex flex-wrap gap-1.5">
                    {need.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-brand-soft px-2.5 py-0.5 text-(length:--text-xs) font-medium text-brand"
                      >
                        {chip}
                      </span>
                    ))}
                  </span>
                </Link>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function BrandStripSection({ section, context }: SectionProps) {
  if (context.brands.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="brand-heading" className="border-b border-border py-8">
      <div className="container-store">
        <p className="text-center text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {section.eyebrow ?? 'Brand universe'}
        </p>
        <h2 id="brand-heading" className="sr-only">
          {section.title ?? 'Thương hiệu tại TechStore'}
        </h2>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {context.brands.map((brand) => (
            <li key={brand.slug}>
              <Link
                href={`/products${buildCatalogQuery({ brand: brand.slug })}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg-muted shadow-(--shadow-sm) transition-all hover:border-brand hover:text-brand"
              >
                {brand.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function EditorialSection({ section }: SectionProps) {
  return (
    <section
      aria-labelledby="editorial-heading"
      className="border-b border-border bg-surface-inverse text-fg-inverse"
    >
      <div className="container-store grid gap-10 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
        <ScrollReveal>
          <div>
            {section.eyebrow ? (
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/45">
                {section.eyebrow}
              </p>
            ) : null}
            <h2
              id="editorial-heading"
              className="mt-2 text-balance text-(length:--text-3xl) font-semibold tracking-tight"
            >
              {section.title ?? 'Máy tốt không chỉ là thông số.'}
            </h2>
            {section.subtitle ? (
              <p className="mt-4 max-w-md text-(length:--text-base) leading-relaxed text-white/70">
                {section.subtitle}
              </p>
            ) : null}
            <Link
              href="#guides"
              className="mt-6 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-white underline-offset-4 hover:underline"
            >
              Đọc gợi ý chọn máy →
            </Link>
          </div>
        </ScrollReveal>
        <ul className="grid grid-cols-2 gap-3">
          {[
            { label: 'Học tập', useCase: 'hoc-tap' },
            { label: 'Lập trình', useCase: 'lap-trinh' },
            { label: 'Sáng tạo', useCase: 'sang-tao' },
            { label: 'Di chuyển', useCase: 'di-chuyen' },
          ].map((item, index) => (
            <li key={item.useCase}>
              <ScrollReveal delayMs={index * 70}>
                <Link
                  href={`/products${buildCatalogQuery({ useCase: item.useCase })}`}
                  className="flex min-h-28 items-end rounded-(--radius-lg) border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <span className="text-(length:--text-base) font-semibold">{item.label}</span>
                </Link>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function TrustSection({ section }: SectionProps) {
  return (
    <section id="trust" aria-labelledby="trust-heading" className="section-y">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Cam kết mua sắm rõ ràng'}
          description={section.subtitle ?? undefined}
          titleId="trust-heading"
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_ITEMS.map((item, index) => (
            <li key={item.title}>
              <ScrollReveal delayMs={(index % 3) * 60}>
                <div className="h-full rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)">
                  <p className="font-semibold tracking-tight text-fg">{item.title}</p>
                  <p className="mt-2 text-(length:--text-sm) leading-relaxed text-fg-muted">
                    {item.body}
                  </p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function GuidesSection({ section }: SectionProps) {
  return (
    <section id="guides" aria-labelledby="guides-heading" className="section-y bg-bg-secondary/60">
      <div className="container-store">
        <SectionHeader
          eyebrow={section.eyebrow ?? undefined}
          title={section.title ?? 'Chọn máy không cần “rành công nghệ”'}
          description={section.subtitle ?? undefined}
          titleId="guides-heading"
        />
        <ul className="grid gap-4 md:grid-cols-3">
          {GUIDE_LINKS.map((guide) => (
            <li key={guide.href + guide.title}>
              <ScrollReveal>
                <Link
                  href={guide.href}
                  className="reveal-soft flex h-full flex-col rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                >
                  <p className="text-(length:--text-base) font-semibold text-fg">{guide.title}</p>
                  <p className="mt-2 flex-1 text-(length:--text-sm) text-fg-muted">{guide.body}</p>
                  <span className="mt-4 text-(length:--text-sm) font-semibold text-brand">
                    Xem gợi ý →
                  </span>
                </Link>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function NewsletterSection({ section }: SectionProps) {
  return (
    <section id="newsletter" aria-labelledby="newsletter-heading" className="section-y">
      <div className="container-store">
        <ScrollReveal>
          <div className="overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-(--shadow-md)">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="px-6 py-10 sm:px-10">
                <p className="eyebrow">{section.eyebrow ?? 'Theo dõi giá'}</p>
                <h2
                  id="newsletter-heading"
                  className="mt-2 text-(length:--text-2xl) font-semibold tracking-tight"
                >
                  {section.title ?? 'Tìm nhanh thiết bị bạn đang quan tâm'}
                </h2>
                <p className="mt-2 text-(length:--text-sm) text-fg-muted">
                  {section.subtitle ??
                    'Nhập từ khóa để mở catalog đã lọc. Chưa có hệ thống gửi email nên không thu địa chỉ của bạn.'}
                </p>
                <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/products" method="get">
                  <label htmlFor="newsletter-query" className="sr-only">
                    Từ khóa sản phẩm
                  </label>
                  <input
                    id="newsletter-query"
                    name="q"
                    type="search"
                    required
                    placeholder="Ví dụ: laptop mỏng nhẹ"
                    className="field-input flex-1"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
                  >
                    Mở catalog
                  </button>
                </form>
              </div>
              <div className="flex flex-col justify-center gap-3 border-t border-border bg-surface-inverse px-6 py-10 text-fg-inverse sm:px-10 lg:border-l lg:border-t-0">
                <p className="text-(length:--text-sm) font-semibold">Lưu lại trên tài khoản</p>
                <p className="text-(length:--text-sm) text-white/65">
                  Hồ sơ giao hàng, wishlist, so sánh và mã đơn được giữ trên thiết bị của bạn.
                </p>
                <Link
                  href="/account"
                  className="inline-flex min-h-11 w-fit items-center rounded-(--radius-md) border border-white/20 px-4 text-(length:--text-sm) font-semibold hover:bg-white/10"
                >
                  Mở tài khoản →
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
