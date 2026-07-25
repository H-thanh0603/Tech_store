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
    <footer className="mt-auto border-t border-border bg-surface-inverse text-fg-inverse">
      <div className="container-store grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <div className="inline-flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-bold text-accent-fg"
            >
              TS
            </span>
            <p className="text-(length:--text-lg) font-semibold tracking-tight">TechStore</p>
          </div>
          <p className="max-w-sm text-(length:--text-sm) leading-relaxed text-fg-inverse/70">
            Thiết bị công nghệ chọn lọc — thông số rõ, giá minh bạch, mua nhanh với COD hoặc
            chuyển khoản. Guest checkout hoặc đăng nhập để lưu hồ sơ.
          </p>
          <p className="text-(length:--text-xs) text-fg-inverse/50">
            Demo store · Catalog seed · Guest + local account
          </p>
        </div>

        <FooterColumn title="Danh mục" links={EXPLORE} />
        <FooterColumn title="Hỗ trợ" links={SUPPORT} />
        <FooterColumn title="Cửa hàng" links={STORE} />
      </div>

      <div className="border-t border-white/10">
        <div className="container-store flex flex-col gap-2 py-5 text-(length:--text-xs) text-fg-inverse/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} TechStore. Không thu thập dữ liệu nhạy cảm không cần thiết.</p>
          <p>Vi-VN · VND · Mobile-first</p>
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
      <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-fg-inverse/45">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="inline-flex min-h-10 items-center text-(length:--text-sm) text-fg-inverse/75 transition-colors hover:text-fg-inverse"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
