import Link from 'next/link'

const ITEMS = [
  { href: '/products?category=laptop', label: 'Laptop học tập · văn phòng' },
  { href: '/#need-selector', label: 'Gợi ý theo nhu cầu' },
  { href: '/track-order', label: 'Tra cứu đơn 24/7' },
  { href: '/account', label: 'Lưu hồ sơ & wishlist' },
  { href: '/products?useCase=gaming', label: 'Gaming setup chọn lọc' },
]

export function PromoStrip() {
  return (
    <div className="border-b border-border bg-brand text-accent-fg">
      <div className="container-store flex items-center gap-6 overflow-hidden py-2">
        <p className="hidden shrink-0 text-(length:--text-xs) font-bold uppercase tracking-[0.12em] sm:block">
          Ưu đãi
        </p>
        <div className="relative flex min-w-0 flex-1 overflow-hidden">
          <ul className="promo-marquee flex min-w-max items-center gap-8">
            {[...ITEMS, ...ITEMS].map((item, i) => (
              <li key={`${item.href}-${i}`}>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 text-(length:--text-xs) font-semibold tracking-wide text-accent-fg/95 hover:text-white"
                >
                  <span aria-hidden className="opacity-60">
                    ◆
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
