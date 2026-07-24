import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/products', label: 'Danh mục sản phẩm' },
  { href: '/products?category=laptop', label: 'Laptop' },
  { href: '/products?category=dien-thoai', label: 'Điện thoại' },
  { href: '/track-order', label: 'Theo dõi đơn hàng' },
  { href: '/cart', label: 'Giỏ hàng' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-surface-inverse text-fg-inverse">
      <div className="container-store grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr] lg:grid-cols-[1.6fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-(--radius-md) bg-accent text-(length:--text-sm) font-bold text-accent-fg"
            >
              TS
            </span>
            <p className="text-(length:--text-lg) font-semibold tracking-tight">TechStore</p>
          </div>
          <p className="max-w-sm text-(length:--text-sm) leading-relaxed text-fg-inverse/70">
            Cửa hàng công nghệ chọn lọc — thiết bị rõ thông số, giá minh bạch, mua
            nhanh với COD hoặc chuyển khoản.
          </p>
        </div>

        <div>
          <p className="eyebrow text-fg-inverse/50">Khám phá</p>
          <ul className="mt-3 flex flex-col gap-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
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

        <div>
          <p className="eyebrow text-fg-inverse/50">Cam kết</p>
          <ul className="mt-3 flex flex-col gap-2 text-(length:--text-sm) text-fg-inverse/75">
            <li>Giá hiển thị đã gồm VAT demo</li>
            <li>Giữ hàng COD / chuyển khoản 24h</li>
            <li>Theo dõi đơn bằng mã + SĐT</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-store flex flex-col gap-1 py-5 text-(length:--text-xs) text-fg-inverse/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} TechStore. Dữ liệu demo cho môi trường phát triển.</p>
          <p>Local Supabase · Guest checkout · Precision Atelier UI</p>
        </div>
      </div>
    </footer>
  )
}
