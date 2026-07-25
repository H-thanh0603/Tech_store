import Image from 'next/image'
import Link from 'next/link'

import { FlashSaleSection } from '@/components/commerce/flash-sale'
import { ProductGrid } from '@/components/commerce/product-grid'
import { RecentlyViewedSection } from '@/components/commerce/recently-viewed'
import { ScrollReveal } from '@/components/home/scroll-reveal'
import { SectionHeader } from '@/components/ui/section-header'
import {
  CATEGORY_EXPLORER,
  GUIDE_LINKS,
  needSelectorItems,
  TRUST_ITEMS,
} from '@/lib/catalog/highlights'
import type { FlashOfferCard } from '@/lib/catalog/social'
import { formatPrice } from '@/lib/format'
import type { ProductCardData } from '@/lib/catalog/types'

type HomePageProps = {
  featured: ProductCardData[]
  total: number
  flashOffers?: FlashOfferCard[]
}

const PROMO_BANNERS = [
  {
    href: '/products?category=laptop',
    eyebrow: 'Laptop',
    title: 'Máy học & làm việc chọn lọc',
    body: 'Pin tốt, màn rõ, giá VND minh bạch.',
    tone: 'dark' as const,
  },
  {
    href: '/products?category=dien-thoai',
    eyebrow: 'Mobile',
    title: 'Điện thoại dùng mỗi ngày',
    body: 'Chụp ảnh, xem phim, app mượt.',
    tone: 'brand' as const,
  },
  {
    href: '/products?useCase=gaming',
    eyebrow: 'Gaming',
    title: 'Setup chơi game cân bằng',
    body: 'Hiệu năng thật — không buzzword.',
    tone: 'soft' as const,
  },
]

const BRANDS = ['Apple', 'Samsung', 'ASUS', 'Dell', 'Lenovo', 'Logitech', 'Sony', 'Xiaomi']

export function HomePageView({ featured, total, flashOffers = [] }: HomePageProps) {
  const heroProduct = featured[0] ?? null
  const secondary = featured.slice(1, 3)
  const spotlight = featured.slice(0, 4)
  const needs = needSelectorItems()

  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <section aria-labelledby="home-heading" className="surface-hero">
        <div className="container-store relative z-10 grid gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16 xl:py-20">
          <div className="flex flex-col gap-6 animate-hero-in">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/70">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-brand" aria-hidden />
              Editorial tech · Guest checkout
            </p>
            <h1
              id="home-heading"
              className="max-w-xl text-balance font-display text-(length:--text-display) font-semibold leading-[1.05] tracking-tight text-white"
            >
              Công nghệ chọn lọc — mua nhanh, hiểu rõ.
            </h1>
            <p className="max-w-lg text-(length:--text-lg) leading-relaxed text-white/72">
              Gợi ý thiết bị theo nhu cầu thật: học tập, code, sáng tạo hay di chuyển. Giá VND rõ,
              tồn kho thật, COD hoặc chuyển khoản.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-brand px-6 text-(length:--text-sm) font-semibold text-accent-fg shadow-(--shadow-glow) transition-all duration-(--duration-fast) hover:bg-brand-hover hover:scale-[1.02]"
              >
                Khám phá catalog
              </Link>
              <Link
                href="#need-selector"
                className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) border border-white/20 bg-white/5 px-6 text-(length:--text-sm) font-semibold text-white transition-colors hover:bg-white/10"
              >
                Chọn theo nhu cầu
              </Link>
              <Link
                href="/account/login"
                className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) px-4 text-(length:--text-sm) font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
              >
                Tài khoản
              </Link>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 max-w-md">
              {[
                { k: 'Sản phẩm', v: String(total || '—') },
                { k: 'Guest', v: 'Checkout' },
                { k: 'Hỗ trợ', v: 'Tra cứu đơn' },
              ].map((stat) => (
                <div key={stat.k}>
                  <dt className="text-(length:--text-xs) text-white/45">{stat.k}</dt>
                  <dd className="mt-0.5 text-(length:--text-sm) font-semibold text-white">{stat.v}</dd>
                </div>
              ))}
            </dl>
            {heroProduct ? (
              <p className="text-(length:--text-sm) text-white/55">
                Nổi bật:{' '}
                <Link
                  href={`/products/${heroProduct.slug}`}
                  className="font-medium text-white/85 underline-offset-2 hover:underline"
                >
                  {heroProduct.name}
                </Link>{' '}
                từ {formatPrice(heroProduct.minPrice)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 animate-hero-in-delay">
            {heroProduct ? (
              <Link
                href={`/products/${heroProduct.slug}`}
                className="group relative overflow-hidden rounded-(--radius-xl) border border-white/10 bg-white/5 p-3 sm:col-span-2"
              >
                <div className="absolute right-4 top-4 z-10 rounded-full bg-brand px-3 py-1 text-(length:--text-xs) font-bold text-accent-fg">
                  Featured
                </div>
                <div className="aspect-[16/10] overflow-hidden rounded-(--radius-lg) bg-black/20">
                  {heroProduct.imageUrl ? (
                    <Image
                      src={heroProduct.imageUrl}
                      alt={heroProduct.imageAlt ?? heroProduct.name}
                      width={1200}
                      height={750}
                      priority
                      className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-white/40">Chưa có ảnh</div>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 px-1">
                  <div>
                    <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-white/50">
                      {heroProduct.brandName ?? 'Featured'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-(length:--text-base) font-semibold text-white">
                      {heroProduct.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-(length:--text-sm) font-semibold tabular-nums text-white">
                    {formatPrice(heroProduct.minPrice)}
                  </p>
                </div>
              </Link>
            ) : null}
            {secondary.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group overflow-hidden rounded-(--radius-lg) border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-(--radius-md) bg-black/20">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.imageAlt ?? product.name}
                      width={600}
                      height={450}
                      className="h-full w-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-(length:--text-sm) font-medium text-white">
                  {product.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <FlashSaleSection offers={flashOffers} />

      {/* 2. Promo banners */}
      <section aria-label="Banner ưu đãi" className="border-b border-border bg-bg-secondary/50">
        <div className="container-store grid gap-3 py-6 md:grid-cols-3">
          {PROMO_BANNERS.map((banner, i) => (
            <ScrollReveal key={banner.href} delayMs={i * 80}>
              <Link
                href={banner.href}
                className={`reveal-soft group flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-(--radius-xl) p-5 shadow-(--shadow-sm) ${
                  banner.tone === 'dark'
                    ? 'bg-surface-inverse text-fg-inverse'
                    : banner.tone === 'brand'
                      ? 'bg-brand text-accent-fg'
                      : 'border border-border bg-bg-elevated text-fg'
                }`}
              >
                <div>
                  <p
                    className={`text-(length:--text-xs) font-bold uppercase tracking-[0.14em] ${
                      banner.tone === 'soft' ? 'text-fg-subtle' : 'opacity-70'
                    }`}
                  >
                    {banner.eyebrow}
                  </p>
                  <p className="mt-2 text-(length:--text-lg) font-semibold tracking-tight">
                    {banner.title}
                  </p>
                  <p
                    className={`mt-1 text-(length:--text-sm) ${
                      banner.tone === 'soft' ? 'text-fg-muted' : 'opacity-80'
                    }`}
                  >
                    {banner.body}
                  </p>
                </div>
                <span className="mt-4 text-(length:--text-sm) font-semibold underline-offset-4 group-hover:underline">
                  Khám phá →
                </span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* 3. Categories mosaic */}
      <section aria-labelledby="categories-heading" className="section-y border-b border-border">
        <div className="container-store">
          <SectionHeader
            eyebrow="Khám phá"
            title="Mua theo danh mục"
            description="Dropdown danh mục trên header sẵn sàng mở rộng — dưới đây là lối vào nhanh."
            titleId="categories-heading"
            actionHref="/products"
            actionLabel="Tất cả sản phẩm"
          />
          <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {CATEGORY_EXPLORER.map((cat, i) => (
              <li key={cat.href + cat.label} className={cat.span}>
                <ScrollReveal delayMs={i * 40}>
                  <Link
                    href={cat.href}
                    className="reveal-soft flex h-full min-h-36 flex-col justify-end overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                  >
                    <span
                      className="mb-auto inline-flex size-10 items-center justify-center rounded-(--radius-md) bg-brand-soft text-(length:--text-sm) font-bold text-brand"
                      aria-hidden
                    >
                      {cat.label.slice(0, 1)}
                    </span>
                    <p className="text-(length:--text-xl) font-semibold tracking-tight text-fg">
                      {cat.label}
                    </p>
                    <p className="mt-1 text-(length:--text-sm) text-fg-muted">{cat.blurb}</p>
                  </Link>
                </ScrollReveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Need selector */}
      <section
        id="need-selector"
        aria-labelledby="need-heading"
        className="section-y bg-bg-secondary/70"
      >
        <div className="container-store">
          <SectionHeader
            eyebrow="Gợi ý thông minh"
            title="Chọn nhu cầu, chúng tôi gợi ý thiết bị"
            description="Rule-based theo use case trong catalog — không bịa review hay scarcity."
            titleId="need-heading"
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {needs.map((need, i) => (
              <li key={need.id}>
                <ScrollReveal delayMs={(i % 4) * 50}>
                  <Link
                    href={need.href}
                    className="reveal-soft flex h-full flex-col rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                  >
                    <p className="text-(length:--text-base) font-semibold text-fg">{need.label}</p>
                    <p className="mt-2 flex-1 text-(length:--text-sm) leading-relaxed text-fg-muted">
                      {need.blurb}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {need.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-brand-soft px-2.5 py-0.5 text-(length:--text-xs) font-medium text-brand"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </Link>
                </ScrollReveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Featured */}
      <section aria-labelledby="featured-heading" className="section-y">
        <div className="container-store">
          <SectionHeader
            eyebrow="Đáng xem"
            title="Thiết bị đang có trong kho"
            description={`${total} sản phẩm — giá và tồn kho từ database.`}
            titleId="featured-heading"
            actionHref="/products"
            actionLabel="Xem thêm"
          />
          {featured.length > 0 ? (
            <ProductGrid products={featured.slice(0, 8)} />
          ) : (
            <div className="surface-panel p-8">
              <p className="font-medium">Chưa có sản phẩm</p>
              <p className="mt-1 text-(length:--text-sm) text-fg-muted">
                Chạy seed Supabase để hiển thị catalog.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 6. Product spotlight strip */}
      {spotlight.length > 0 ? (
        <section aria-labelledby="spotlight-heading" className="border-y border-border bg-bg-secondary/40">
          <div className="container-store section-y">
            <SectionHeader
              eyebrow="Spotlight"
              title="So nhanh theo lifestyle"
              description="Nhẹ · mạnh · cân bằng — chọn hướng rồi lọc catalog."
              titleId="spotlight-heading"
            />
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {spotlight.map((p, i) => (
                <li key={p.id}>
                  <ScrollReveal delayMs={i * 60}>
                    <Link
                      href={`/products/${p.slug}`}
                      className="reveal-soft group flex h-full flex-col overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-(--shadow-sm)"
                    >
                      <div className="relative aspect-[4/3] bg-surface-muted">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.imageAlt ?? p.name}
                            fill
                            sizes="(max-width:768px) 100vw, 25vw"
                            className="object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.04]"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-4">
                        <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                          {p.brandName ?? 'TechStore'}
                        </p>
                        <p className="line-clamp-2 font-semibold text-fg">{p.name}</p>
                        <p className="mt-auto pt-2 text-(length:--text-sm) font-semibold tabular-nums">
                          {formatPrice(p.minPrice)}
                        </p>
                      </div>
                    </Link>
                  </ScrollReveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 7. Editorial */}
      <section
        aria-labelledby="editorial-heading"
        className="border-b border-border bg-surface-inverse text-fg-inverse"
      >
        <div className="container-store grid gap-10 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <ScrollReveal>
            <div>
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/45">
                Editorial
              </p>
              <h2
                id="editorial-heading"
                className="mt-2 text-balance text-(length:--text-3xl) font-semibold tracking-tight"
              >
                Máy tốt không chỉ là thông số — là việc bạn làm được mỗi ngày.
              </h2>
              <p className="mt-4 max-w-md text-(length:--text-base) leading-relaxed text-white/70">
                TechStore diễn giải lợi ích: mang đi học, code cả ngày, chỉnh video, hay chơi game.
                Bạn hiểu máy trước khi mua.
              </p>
              <Link
                href="#guides"
                className="mt-6 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-white underline-offset-4 hover:underline"
              >
                Đọc gợi ý chọn máy →
              </Link>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-2 gap-3">
            {['Học tập', 'Lập trình', 'Sáng tạo', 'Di chuyển'].map((label, i) => (
              <ScrollReveal key={label} delayMs={i * 70}>
                <div className="flex min-h-28 items-end rounded-(--radius-lg) border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                  <p className="text-(length:--text-base) font-semibold">{label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Brand strip */}
      <section aria-label="Thương hiệu" className="border-b border-border py-8">
        <div className="container-store">
          <p className="text-center text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            Brand universe
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {BRANDS.map((brand) => (
              <li key={brand}>
                <Link
                  href={`/products?q=${encodeURIComponent(brand)}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg-muted shadow-(--shadow-sm) transition-all hover:border-brand hover:text-brand"
                >
                  {brand}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 9. Trust */}
      <section id="trust" aria-labelledby="trust-heading" className="section-y">
        <div className="container-store">
          <SectionHeader
            eyebrow="Tin cậy"
            title="Cam kết mua sắm rõ ràng"
            description="Không fake review, không countdown giả, không số liệu bịa."
            titleId="trust-heading"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_ITEMS.map((item, i) => (
              <li key={item.title}>
                <ScrollReveal delayMs={(i % 3) * 60}>
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

      {/* 10. Guides */}
      <section id="guides" aria-labelledby="guides-heading" className="section-y bg-bg-secondary/60">
        <div className="container-store">
          <SectionHeader
            eyebrow="Hướng dẫn"
            title="Chọn máy không cần “rành công nghệ”"
            description="Bài ngắn dẫn tới catalog đã lọc — nội dung thật, CTA rõ."
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

      <RecentlyViewedSection />

      {/* 11. Newsletter */}
      <section id="newsletter" aria-labelledby="newsletter-heading" className="section-y">
        <div className="container-store">
          <ScrollReveal>
            <div className="overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-(--shadow-md)">
              <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
                <div className="px-6 py-10 sm:px-10">
                  <p className="eyebrow">Price alert</p>
                  <h2
                    id="newsletter-heading"
                    className="mt-2 text-(length:--text-2xl) font-semibold tracking-tight"
                  >
                    Nhận thông báo khi máy bạn quan tâm giảm giá
                  </h2>
                  <p className="mt-2 text-(length:--text-sm) text-fg-muted">
                    Demo UI — chưa gửi email thật. Không thu thập dữ liệu nhạy cảm không cần thiết.
                  </p>
                  <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/products" method="get">
                    <label htmlFor="newsletter-email" className="sr-only">
                      Email
                    </label>
                    <input
                      id="newsletter-email"
                      name="q"
                      type="email"
                      required
                      placeholder="email@example.com"
                      className="field-input flex-1"
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
                    >
                      Đăng ký quan tâm
                    </button>
                  </form>
                </div>
                <div className="flex flex-col justify-center gap-3 border-t border-border bg-surface-inverse px-6 py-10 text-fg-inverse sm:px-10 lg:border-l lg:border-t-0">
                  <p className="text-(length:--text-sm) font-semibold">Hoặc quản lý trên tài khoản</p>
                  <p className="text-(length:--text-sm) text-white/65">
                    Lưu hồ sơ, wishlist, so sánh và mã đơn trên thiết bị của bạn.
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
    </div>
  )
}
