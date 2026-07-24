import Link from 'next/link'

import { ProductGrid } from '@/components/commerce/product-grid'
import { getProducts } from '@/lib/catalog/queries'

const CATEGORIES = [
  {
    href: '/products?category=laptop',
    label: 'Laptop',
    blurb: 'Làm việc & sáng tạo',
    tone: 'from-cyan-500/20 to-transparent',
  },
  {
    href: '/products?category=dien-thoai',
    label: 'Điện thoại',
    blurb: 'Flagship chọn lọc',
    tone: 'from-amber-400/20 to-transparent',
  },
  {
    href: '/products?category=phu-kien',
    label: 'Phụ kiện',
    blurb: 'Tai nghe & hơn nữa',
    tone: 'from-emerald-400/20 to-transparent',
  },
] as const

const TRUST = [
  { title: 'Giá rõ ràng', body: 'Hiển thị cả số, không phí ẩn trong demo.' },
  { title: 'Giữ hàng thông minh', body: 'COD giữ stock; chuyển khoản giữ 24 giờ.' },
  { title: 'Theo dõi đơn', body: 'Tra cứu bằng mã đơn + số điện thoại.' },
] as const

export default async function HomePage() {
  const featured = await getProducts({ sort: 'relevance', page: 1 })
  const spotlight = featured.products.slice(0, 4)

  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      {/* Hero — product-first, not marketing fluff */}
      <section
        aria-labelledby="home-heading"
        className="surface-hero relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:p-12"
      >
        <div className="relative z-10 flex flex-col gap-5">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/75">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" aria-hidden />
            Cửa hàng demo · Guest checkout
          </p>
          <h1
            id="home-heading"
            className="max-w-xl text-balance font-display text-(length:--text-hero) font-semibold leading-[1.08] tracking-tight text-white"
          >
            Thiết bị công nghệ chọn lọc, mua trong vài bước.
          </h1>
          <p className="max-w-lg text-(length:--text-lg) leading-relaxed text-white/70">
            Xem tồn kho thật, so giá biến thể, áp mã giảm và thanh toán COD hoặc
            chuyển khoản — không cần tài khoản.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/products"
              className="inline-flex min-h-(--size-touch) items-center justify-center rounded-(--radius-md) bg-accent px-5 text-(length:--text-sm) font-semibold text-accent-fg shadow-(--shadow-glow) transition-all duration-(--duration-fast) hover:bg-accent-hover"
            >
              Xem sản phẩm
            </Link>
            <Link
              href="/track-order"
              className="inline-flex min-h-(--size-touch) items-center justify-center rounded-(--radius-md) border border-white/20 bg-white/5 px-5 text-(length:--text-sm) font-semibold text-white transition-colors duration-(--duration-fast) hover:bg-white/10"
            >
              Theo dõi đơn
            </Link>
          </div>
        </div>

        <div className="relative z-10 grid gap-3 sm:grid-cols-2">
          {spotlight.slice(0, 2).map((product, index) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className={[
                'group flex flex-col overflow-hidden rounded-(--radius-lg) border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all duration-(--duration-normal) ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10',
                index === 1 ? 'sm:mt-6' : '',
              ].join(' ')}
            >
              <div className="aspect-[4/3] overflow-hidden rounded-(--radius-md) bg-black/20">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.imageAlt ?? product.name}
                    className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-expo) group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-(length:--text-sm) text-white/40">
                    Chưa có ảnh
                  </div>
                )}
              </div>
              <p className="mt-3 text-(length:--text-xs) font-semibold uppercase tracking-wide text-white/50">
                {product.brandName ?? product.categorySlug}
              </p>
              <p className="line-clamp-2 text-(length:--text-sm) font-medium text-white">
                {product.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Danh mục</p>
            <h2 id="categories-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight">
              Mua theo nhu cầu
            </h2>
          </div>
          <Link
            href="/products"
            className="text-(length:--text-sm) font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Tất cả sản phẩm →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <li key={cat.href}>
              <Link
                href={cat.href}
                className="group relative flex min-h-36 flex-col justify-end overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm) transition-all duration-(--duration-normal) ease-(--ease-out-expo) hover:-translate-y-0.5 hover:shadow-(--shadow-md)"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cat.tone}`}
                />
                <p className="relative text-(length:--text-xl) font-semibold tracking-tight text-fg">
                  {cat.label}
                </p>
                <p className="relative mt-1 text-(length:--text-sm) text-fg-muted">{cat.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured grid */}
      <section aria-labelledby="featured-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Nổi bật</p>
            <h2 id="featured-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight">
              Đang có sẵn trong kho demo
            </h2>
          </div>
          <p className="text-(length:--text-sm) text-fg-muted" aria-live="polite">
            {featured.total} sản phẩm
          </p>
        </div>
        {spotlight.length > 0 ? (
          <ProductGrid products={spotlight} />
        ) : (
          <div className="surface-panel flex flex-col items-start gap-3 p-8">
            <p className="font-medium">Chưa có sản phẩm để hiển thị</p>
            <p className="text-(length:--text-sm) text-fg-muted">
              Hãy chắc Supabase local đã seed catalog.
            </p>
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section
        aria-labelledby="trust-heading"
        className="grid gap-4 rounded-(--radius-xl) border border-border bg-surface-muted/80 p-5 sm:grid-cols-3 sm:p-6"
      >
        <h2 id="trust-heading" className="sr-only">
          Vì sao chọn TechStore
        </h2>
        {TRUST.map((item) => (
          <div key={item.title} className="flex flex-col gap-1.5 px-1 py-2">
            <p className="text-(length:--text-base) font-semibold tracking-tight text-fg">
              {item.title}
            </p>
            <p className="text-(length:--text-sm) leading-relaxed text-fg-muted">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
