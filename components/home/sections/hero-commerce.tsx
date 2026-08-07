import Image from 'next/image'
import Link from 'next/link'

import { bannersFor, type SectionProps } from '@/components/home/sections/types'
import { IconChevronRight, navIcon } from '@/components/ui/icons'
import { formatPrice } from '@/lib/format'
import type { Banner } from '@/lib/content/types'

/**
 * Hero commerce zone (DESIGN_CELLPHONES_INSPIRED.md §4.1).
 *
 * Desktop is the retail three-column layout: category rail, main banner, side
 * cards. Mobile drops the rail to a scrollable category row and stacks the rest,
 * because a 260px sidebar on a phone is just noise.
 *
 * Banners may have no creative yet (the seed ships none), so every card degrades
 * to a typographic panel instead of rendering a broken image or a fake mockup.
 * The image slot keeps a fixed aspect ratio either way, so there is no layout
 * shift when an editor adds artwork.
 */
export function HeroCommerceSection({ section, context }: SectionProps) {
  const [mainBanner] = bannersFor(context, section.config.bannerSlot ?? 'home_hero', 1)
  const sideBanners = bannersFor(
    context,
    section.config.sideBannerSlot ?? 'home_promo_grid',
    section.config.sideLimit ?? 3,
  )
  const categories = context.navEntries.slice(0, 8)
  const heroProduct = context.products[0] ?? null
  const ctaHref = typeof section.config.ctaHref === 'string' ? section.config.ctaHref : '/products'
  const ctaLabel =
    typeof section.config.ctaLabel === 'string' ? section.config.ctaLabel : 'Khám phá catalog'
  const showStats = section.config.showStats === true

  const title = mainBanner?.title ?? section.title ?? 'Công nghệ chọn lọc'
  const subtitle = mainBanner?.subtitle ?? section.subtitle
  const href = mainBanner?.href ?? ctaHref

  return (
    <section aria-labelledby="hero-heading" className="surface-hero border-b border-border">
      <div className="container-store relative z-10 grid gap-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)_18rem] lg:gap-4 lg:py-8">
        {/* Category rail — desktop only; mobile uses the row below the banner. */}
        <nav
          aria-label="Danh mục nổi bật"
          className="hidden rounded-(--radius-lg) border border-border bg-bg-elevated/95 p-2 shadow-sm lg:block"
        >
          <ul className="flex flex-col gap-0.5">
            {categories.map((entry) => {
              const Icon = navIcon(entry.iconKey)
              return (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="flex min-h-11 items-center gap-2.5 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted transition-all hover:bg-brand-soft hover:text-brand"
                  >
                    {Icon ? <Icon size={18} className="text-brand" /> : null}
                    <span className="min-w-0 flex-1 truncate font-semibold">{entry.label}</span>
                    <IconChevronRight size={14} className="opacity-40" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Main banner */}
        <div className="flex flex-col gap-3">
          <Link
            href={href}
            className="group relative flex flex-1 flex-col justify-end overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-md transition-all hover:shadow-lg hover:border-brand/40"
          >
            <div className="relative aspect-[16/9] w-full sm:aspect-[2/1] lg:aspect-[21/9]">
              {mainBanner?.imageDesktopUrl ? (
                <Image
                  src={mainBanner.imageDesktopUrl}
                  alt={mainBanner.title ?? ''}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.02]"
                />
              ) : heroProduct?.imageUrl ? (
                <Image
                  src={heroProduct.imageUrl}
                  alt={heroProduct.imageAlt ?? heroProduct.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover opacity-85 transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.02]"
                />
              ) : null}
              <div className="absolute inset-0 flex flex-col justify-end gap-2 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent p-5 sm:p-7">
                {section.eyebrow ? (
                  <span className="inline-flex w-fit rounded-full bg-brand-soft/90 px-3 py-1 text-(length:--text-xs) font-bold uppercase tracking-[0.14em] text-brand border border-brand/20">
                    {section.eyebrow}
                  </span>
                ) : null}
                <h1
                  id="hero-heading"
                  className="max-w-2xl text-balance font-display text-(length:--text-hero) font-extrabold leading-[1.06] tracking-tight text-white drop-shadow-sm"
                >
                  {title}
                </h1>
                {subtitle ? (
                  <p className="max-w-xl text-(length:--text-base) leading-relaxed text-white/90 font-medium">
                    {subtitle}
                  </p>
                ) : null}
                <span className="mt-2 inline-flex w-fit min-h-11 items-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-bold text-white shadow-md transition-all group-hover:bg-brand-hover group-hover:shadow-lg">
                  {ctaLabel} →
                </span>
              </div>
            </div>
          </Link>

          {showStats ? (
            <dl className="grid grid-cols-3 gap-2 rounded-(--radius-lg) border border-border bg-bg-elevated/95 px-4 py-3 shadow-sm">
              {[
                { k: 'Sản phẩm', v: context.total > 0 ? String(context.total) : '—' },
                { k: 'Thanh toán', v: 'COD / CK' },
                { k: 'Đơn hàng', v: 'Tra cứu 24/7' },
              ].map((stat) => (
                <div key={stat.k}>
                  <dt className="text-(length:--text-xs) font-medium text-fg-subtle">{stat.k}</dt>
                  <dd className="mt-0.5 text-(length:--text-sm) font-bold text-fg">
                    {stat.v}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/* Side cards: stacked on desktop, a horizontal rail on mobile. */}
        {sideBanners.length > 0 ? (
          <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {sideBanners.map((banner) => (
              <li key={banner.id} className="w-64 shrink-0 snap-start lg:w-auto lg:flex-1">
                <SideBannerCard banner={banner} />
              </li>
            ))}
          </ul>
        ) : null}

        {/* Mobile category row */}
        <nav aria-label="Danh mục nhanh" className="lg:hidden">
          <ul className="grid grid-cols-4 gap-2">
            {categories.slice(0, 8).map((entry) => {
              const Icon = navIcon(entry.iconKey)
              return (
                <li key={`m-${entry.id}`}>
                  <Link
                    href={entry.href}
                    className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-(--radius-md) border border-border bg-bg-elevated px-1 text-center text-(length:--text-xs) font-medium text-fg shadow-xs transition-colors hover:border-brand hover:text-brand"
                  >
                    {Icon ? <Icon size={20} className="text-brand" /> : null}
                    <span className="line-clamp-2 leading-tight font-semibold">{entry.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {heroProduct ? (
        <div className="container-store relative z-10 pb-6 text-(length:--text-sm) text-fg-muted lg:pb-8">
          Nổi bật:{' '}
          <Link
            href={`/products/${heroProduct.slug}`}
            className="font-bold text-brand underline-offset-2 hover:underline"
          >
            {heroProduct.name}
          </Link>{' '}
          từ <span className="font-bold text-fg">{formatPrice(heroProduct.minPrice)}</span>
        </div>
      ) : null}
    </section>
  )
}

function SideBannerCard({ banner }: { banner: Banner }) {
  return (
    <Link
      href={banner.href}
      className="group flex h-full flex-col justify-between gap-2 overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated p-4 shadow-sm transition-all hover:border-brand/50 hover:shadow-md"
    >
      {banner.imageDesktopUrl ? (
        <span className="relative block aspect-[16/9] overflow-hidden rounded-(--radius-md) bg-bg-secondary">
          <Image
            src={banner.imageDesktopUrl}
            alt={banner.title ?? ''}
            fill
            sizes="(max-width: 1024px) 16rem, 18rem"
            className="object-cover transition-transform group-hover:scale-105"
          />
        </span>
      ) : null}
      <span className="block">
        <span className="block text-(length:--text-sm) font-bold text-fg">
          {banner.title ?? banner.name}
        </span>
        {banner.subtitle ? (
          <span className="mt-1 block text-(length:--text-xs) leading-relaxed text-fg-muted font-medium">
            {banner.subtitle}
          </span>
        ) : null}
      </span>
      <span className="text-(length:--text-xs) font-bold text-brand group-hover:underline">
        Xem ngay →
      </span>
    </Link>
  )
}
