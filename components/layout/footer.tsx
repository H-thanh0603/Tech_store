import Link from 'next/link'

const EXPLORE = [
  { href: '/products', label: 'Tất cả sản phẩm' },
  { href: '/products?category=laptop', label: 'Laptop' },
  { href: '/products?category=dien-thoai', label: 'Điện thoại' },
  { href: '/products?category=phu-kien', label: 'Phụ kiện' },
  { href: '/products?useCase=gaming', label: 'Gaming' },
]

const SUPPORT = [
  { href: '/track-order', label: 'Theo dõi đơn hàng' },
  { href: '/cart', label: 'Giỏ hàng' },
  { href: '/checkout', label: 'Thanh toán' },
  { href: '/account', label: 'Tài khoản khách hàng' },
  { href: '/#trust', label: 'Chính sách & cam kết' },
]

const STORE = [
  { href: '/#need-selector', label: 'Tư vấn theo nhu cầu' },
  { href: '/#guides', label: 'Hướng dẫn chọn máy' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/compare', label: 'So sánh sản phẩm' },
  { href: '/#newsletter', label: 'Nhận tin ưu đãi' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-bg-elevated text-fg">
      <div className="container-store grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <div className="inline-flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-(--radius-md) bg-gradient-to-tr from-brand via-brand-hover to-brand-electric text-(length:--text-sm) font-extrabold text-white shadow-sm shadow-brand/20"
            >
              TS
            </span>
            <p className="text-(length:--text-lg) font-bold tracking-tight text-fg">TechStore</p>
          </div>
          <p className="max-w-sm text-(length:--text-sm) leading-relaxed text-fg-muted font-medium">
            Thiết bị công nghệ chọn lọc — thông số rõ, giá minh bạch, mua nhanh với COD hoặc
            chuyển khoản. Guest checkout hoặc đăng nhập để lưu hồ sơ.
          </p>
          <div className="flex flex-wrap gap-2 text-(length:--text-xs) font-semibold text-fg-subtle">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand">✓ Chính hãng 100%</span>
            <span className="rounded-full bg-bg-secondary px-2.5 py-1">⚡ Giao hàng 2h</span>
            <span className="rounded-full bg-bg-secondary px-2.5 py-1">🛡️ Bảo hành 12 tháng</span>
          </div>
        </div>

        <FooterColumn title="Danh mục" links={EXPLORE} />
        <FooterColumn title="Hỗ trợ" links={SUPPORT} />
        <FooterColumn title="Cửa hàng" links={STORE} />
      </div>

      <div className="border-t border-border/80 bg-bg-secondary/50">
        <div className="container-store flex flex-col gap-2 py-5 text-(length:--text-xs) font-medium text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} TechStore. Mọi quyền được bảo lưu. Nền tảng bán lẻ công nghệ hàng đầu.</p>
          <p>Vi-VN · VND · Fast Checkout</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ href: string; label: string }>
}) {
  return (
    <div>
      <p className="text-(length:--text-xs) font-bold uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="inline-flex min-h-10 items-center text-(length:--text-sm) font-medium text-fg-muted transition-colors hover:text-brand"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
