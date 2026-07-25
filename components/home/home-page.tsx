import Image from 'next/image'
import Link from 'next/link'

import { ProductGrid } from '@/components/commerce/product-grid'
import { RecentlyViewedSection } from '@/components/commerce/recently-viewed'
import { SectionHeader } from '@/components/ui/section-header'
import {
  CATEGORY_EXPLORER,
  GUIDE_LINKS,
  needSelectorItems,
  TRUST_ITEMS,
} from '@/lib/catalog/highlights'
import { formatPrice } from '@/lib/format'
import type { ProductCardData } from '@/lib/catalog/types'

type HomePageProps = {
  featured: ProductCardData[]
  total: number
}

export function HomePageView({ featured, total }: HomePageProps) {
  const heroProduct = featured[0] ?? null
  const secondary = featured.slice(1, 3)
  const needs = needSelectorItems()

  return (
    <div className="flex flex-col">
      {/* 1. Hero — curated product story */}
      <section aria-labelledby="home-heading" className="surface-hero">
        <div className="container-store relative z-10 grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16 xl:py-20">
          <div className="flex flex-col gap-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/70">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              Editorial tech · Guest checkout
            </p>
            <h1
              id="home-heading"
              className="max-w-xl text-balance font-display text-(length:--text-display) font-semibold leading-[1.05] tracking-tight text-white"
            >
              Chọn thiết bị theo việc bạn làm mỗi ngày.
            </h1>
            <p className="max-w-lg text-(length:--text-lg) leading-relaxed text-white/72">
              TechStore gợi ý máy theo nhu cầu — học tập, lập trình, sáng tạo hay di chuyển —
              với giá VND rõ ràng và tồn kho thật.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg transition-colors hover:bg-brand-hover"
              >
                Xem catalog
              </Link>
              <Link
                href="#need-selector"
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-white/20 bg-white/5 px-5 text-(length:--text-sm) font-semibold text-white transition-colors hover:bg-white/10"
              >
                Chọn theo nhu cầu
              </Link>
            </div>
            {heroProduct ? (
              <p className="text-(length:--text-sm) text-white/55">
                Nổi bật hôm nay:{' '}
                <Link href={`/products/${heroProduct.slug}`} className="font-medium text-white/85 underline-offset-2 hover:underline">
                  {heroProduct.name}
                </Link>{' '}
                từ {formatPrice(heroProduct.minPrice)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heroProduct ? (
              <Link
                href={`/products/${heroProduct.slug}`}
                className="group relative overflow-hidden rounded-(--radius-xl) border border-white/10 bg-white/5 p-3 sm:col-span-2"
              >
                <div className="aspect-[16/10] overflow-hidden rounded-(--radius-lg) bg-black/20">
                  {heroProduct.imageUrl ? (
                    <Image
                      src={heroProduct.imageUrl}
                      alt={heroProduct.imageAlt ?? heroProduct.name}
                      width={1200}
                      height={750}
                      priority
                      className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.03]"
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
                      className="h-full w-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.03]"
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

      {/* 2. Category explorer — uneven mosaic */}
      <section aria-labelledby="categories-heading" className="section-y border-b border-border">
        <div className="container-store">
          <SectionHeader
            eyebrow="Khám phá"
            title="Mua theo danh mục"
            description="Bố cục không đồng đều có chủ đích — laptop là điểm nhấn, các nhóm còn lại dẫn lối nhanh."
            titleId="categories-heading"
            actionHref="/products"
            actionLabel="Tất cả sản phẩm"
          />
          <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {CATEGORY_EXPLORER.map((cat) => (
              <li key={cat.href + cat.label} className={cat.span}>
                <Link
                  href={cat.href}
                  className="reveal-soft flex h-full min-h-36 flex-col justify-end rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
                >
                  <p className="text-(length:--text-xl) font-semibold tracking-tight text-fg">
                    {cat.label}
                  </p>
                  <p className="mt-1 text-(length:--text-sm) text-fg-muted">{cat.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Smart need selector — wow moment */}
      <section
        id="need-selector"
        aria-labelledby="need-heading"
        className="section-y bg-bg-secondary/70"
      >
        <div className="container-store">
          <SectionHeader
            eyebrow="Gợi ý thông minh"
            title="Chọn nhu cầu, chúng tôi gợi ý thiết bị"
            description="Rule-based theo use case thật trong catalog — không bịa review hay scarcity."
            titleId="need-heading"
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {needs.map((need) => (
              <li key={need.id}>
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
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Featured products */}
      <section aria-labelledby="featured-heading" className="section-y">
        <div className="container-store">
          <SectionHeader
            eyebrow="Đáng xem"
            title="Thiết bị đang có trong kho"
            description={`${total} sản phẩm từ seed catalog — giá và tồn kho lấy từ database.`}
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

      {/* 5. Editorial split */}
      <section aria-labelledby="editorial-heading" className="border-y border-border bg-surface-inverse text-fg-inverse">
        <div className="container-store grid gap-10 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
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
              Thay vì chỉ liệt kê RAM và GPU, TechStore diễn giải lợi ích: mang đi học, code cả
              ngày, chỉnh video, hay chơi game. Bạn hiểu máy trước khi mua.
            </p>
            <Link
              href="#guides"
              className="mt-6 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-white underline-offset-4 hover:underline"
            >
              Đọc gợi ý chọn máy →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['Học tập', 'Lập trình', 'Sáng tạo', 'Di chuyển'].map((label) => (
              <div
                key={label}
                className="flex min-h-28 items-end rounded-(--radius-lg) border border-white/10 bg-white/5 p-4"
              >
                <p className="text-(length:--text-base) font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Trust */}
      <section id="trust" aria-labelledby="trust-heading" className="section-y">
        <div className="container-store">
          <SectionHeader
            eyebrow="Tin cậy"
            title="Cam kết mua sắm rõ ràng"
            description="Không fake review, không countdown giả, không số liệu bịa."
            titleId="trust-heading"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_ITEMS.map((item) => (
              <li
                key={item.title}
                className="rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
              >
                <p className="font-semibold tracking-tight text-fg">{item.title}</p>
                <p className="mt-2 text-(length:--text-sm) leading-relaxed text-fg-muted">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Tech guides */}
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
              </li>
            ))}
          </ul>
        </div>
      </section>

      <RecentlyViewedSection />

      {/* 8. Newsletter / price alert */}
      <section id="newsletter" aria-labelledby="newsletter-heading" className="section-y">
        <div className="container-store">
          <div className="rounded-(--radius-xl) border border-border bg-bg-elevated px-6 py-10 shadow-(--shadow-sm) sm:px-10">
            <div className="mx-auto max-w-xl text-center">
              <p className="eyebrow">Price alert</p>
              <h2 id="newsletter-heading" className="mt-2 text-(length:--text-2xl) font-semibold tracking-tight">
                Nhận thông báo khi máy bạn quan tâm giảm giá
              </h2>
              <p className="mt-2 text-(length:--text-sm) text-fg-muted">
                Demo UI — chưa gửi email thật. Chúng tôi không thu thập dữ liệu nhạy cảm không cần
                thiết.
              </p>
              <form
                className="mt-6 flex flex-col gap-3 sm:flex-row"
                action="/products"
                method="get"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email
                </label>
                <input
                  id="newsletter-email"
                  name="q"
                  type="email"
                  required
                  placeholder="email@example.com"
                  className="min-h-11 flex-1 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
                >
                  Đăng ký quan tâm
                </button>
              </form>
              <p className="mt-3 text-(length:--text-xs) text-fg-subtle">
                Bằng việc gửi form demo, bạn chỉ được chuyển tới catalog — không lưu email.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
