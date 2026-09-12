import Image from 'next/image'
import Link from 'next/link'

import { HeroSlider, type HeroSlideItem } from '@/components/home/hero-slider'
import { bannersFor, type SectionProps } from '@/components/home/sections/types'
import { IconChevronRight, navIcon } from '@/components/ui/icons'
import { formatPrice } from '@/lib/format'
import type { Banner } from '@/lib/content/types'

/**
 * Hero commerce zone (DESIGN_CELLPHONES_INSPIRED.md §4.1).
 *
 * Desktop is the retail three-column layout: category rail, enlarged hero slider
 * with multiple auto-rotating product showcase slides, and side cards.
 * Mobile drops the rail to a scrollable category row and stacks the rest.
 */
export function HeroCommerceSection({ section, context }: SectionProps) {
  const heroBanners = bannersFor(context, section.config.bannerSlot ?? 'home_hero', 5)
  const sideBanners = bannersFor(
    context,
    section.config.sideBannerSlot ?? 'home_promo_grid',
    section.config.sideLimit ?? 3,
  )
  const categories = context.navEntries.slice(0, 10)
  const heroProduct = context.products[0] ?? null
  const ctaHref = typeof section.config.ctaHref === 'string' ? section.config.ctaHref : '/products'
  const ctaLabel =
    typeof section.config.ctaLabel === 'string' ? section.config.ctaLabel : 'Khám phá catalog'
  const showStats = section.config.showStats === true

  // Primary banner or section title fallback
  const mainBanner = heroBanners[0] ?? null
  const title = mainBanner?.title ?? section.title ?? 'Công nghệ chọn lọc'
  const subtitle = mainBanner?.subtitle ?? section.subtitle
  const href = mainBanner?.href ?? (heroProduct ? `/products/${heroProduct.slug}` : ctaHref)

  // Build slides: Banner(s) + Top products with images for auto-transition
  const slides: HeroSlideItem[] = []

  // Slide 0: Primary banner or fallback
  slides.push({
    id: mainBanner?.id ?? 'slide-hero-main',
    title,
    subtitle:
      subtitle ??
      (heroProduct
        ? 'Sản phẩm cao cấp được tin dùng nhất hôm nay với ưu đãi hấp dẫn.'
        : 'Giá VND minh bạch, tồn kho thật, giao hàng nhanh toàn quốc.'),
    eyebrow: section.eyebrow ?? (mainBanner ? 'ƯU ĐÃI ĐẶC QUYỀN' : 'CÔNG NGHỆ CHỌN LỌC'),
    href,
    ctaLabel,
    imageUrl: mainBanner?.imageDesktopUrl ?? heroProduct?.imageUrl ?? null,
    imageAlt: mainBanner?.title ?? heroProduct?.imageAlt ?? heroProduct?.name ?? title,
    price: heroProduct?.minPrice ?? null,
    badge: 'HOT DEAL',
    isProduct: !mainBanner?.imageDesktopUrl && Boolean(heroProduct?.imageUrl),
    tabTitle: mainBanner?.title ?? heroProduct?.name ?? title,
    tabDesc: heroProduct?.minPrice ? formatPrice(heroProduct.minPrice) : 'Khám phá ngay',
  })

  const usedHrefs = new Set<string>([href])
  const usedImages = new Set<string>()
  if (slides[0].imageUrl) {
    usedImages.add(slides[0].imageUrl)
  }

  // Add additional banners if configured in home_hero
  for (const b of heroBanners.slice(1)) {
    if (b.href && !usedHrefs.has(b.href)) {
      usedHrefs.add(b.href)
      if (b.imageDesktopUrl) usedImages.add(b.imageDesktopUrl)
      slides.push({
        id: b.id,
        title: b.title ?? b.name,
        subtitle: b.subtitle,
        eyebrow: 'KHUYẾN MÃI HOT',
        href: b.href,
        ctaLabel,
        imageUrl: b.imageDesktopUrl,
        imageAlt: b.title ?? b.name,
        isProduct: false,
        tabTitle: b.title ?? b.name,
        tabDesc:
          b.subtitle && b.subtitle.length > 25 ? b.subtitle.slice(0, 24) + '...' : (b.subtitle ?? 'Ưu đãi hot'),
      })
    }
  }

  // Add distinct products with images for rotating showcase (up to 6 total slides)
  for (const p of context.products) {
    if (slides.length >= 6) break
    const productHref = `/products/${p.slug}`
    if (p.imageUrl && !usedHrefs.has(productHref) && !usedImages.has(p.imageUrl)) {
      usedHrefs.add(productHref)
      usedImages.add(p.imageUrl)
      slides.push({
        id: p.id,
        title: p.name,
        subtitle: p.brandName
          ? `${p.brandName} chính hãng · Bảo hành 12 tháng tận tâm`
          : 'Sản phẩm công nghệ hàng đầu · Cam kết chất lượng',
        eyebrow: p.brandName ? `${p.brandName.toUpperCase()} · CHÍNH HÃNG` : 'SIÊU PHẨM BÁN CHẠY',
        href: productHref,
        ctaLabel: 'Xem chi tiết',
        imageUrl: p.imageUrl,
        imageAlt: p.imageAlt ?? p.name,
        price: p.minPrice,
        brandName: p.brandName,
        badge: p.hasDiscount ? 'GIẢM SỐC' : 'BÁN CHẠY',
        isProduct: true,
        tabTitle: p.name,
        tabDesc: formatPrice(p.minPrice),
      })
    }
  }

  const hasSideBanners = sideBanners.length > 0

  return (
    <section aria-labelledby="hero-heading" className="surface-hero border-b border-border">
      <div
        className={`relative z-10 mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 grid gap-4 lg:gap-5 ${
          hasSideBanners
            ? 'lg:grid-cols-[13rem_minmax(0,1fr)_14rem] xl:grid-cols-[13.5rem_minmax(0,1fr)_14.5rem]'
            : 'lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)]'
        }`}
      >
        {/* Category rail — desktop only; mobile uses the row below the banner. */}
        <nav
          aria-label="Danh mục nổi bật"
          className="hidden rounded-(--radius-lg) border border-border bg-bg-elevated/95 p-2.5 shadow-sm lg:flex lg:flex-col lg:justify-between"
        >
          <ul className="flex flex-col gap-1">
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

        {/* Main hero slider zone */}
        <div className="flex flex-col gap-3 min-w-0">
          <HeroSlider slides={slides} />

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
          <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 lg:h-full lg:justify-between">
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
        <div className="relative z-10 mx-auto w-full max-w-[88rem] px-4 pb-6 text-(length:--text-sm) text-fg-muted sm:px-6 lg:px-8 lg:pb-8">
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
        <span className="relative block aspect-[16/10] overflow-hidden rounded-(--radius-md) bg-bg-secondary">
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
