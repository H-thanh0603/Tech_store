import Link from 'next/link'
import type { ReactNode } from 'react'

type HeaderProps = {
  children?: ReactNode
  cartCount?: number
}

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/products', label: 'Sản phẩm' },
  { href: '/track-order', label: 'Theo dõi đơn' },
]

export function Header({ children, cartCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface-raised/80 backdrop-blur-xl">
      <div className="container-store flex flex-wrap items-center gap-3 py-3 sm:gap-4">
        <Link
          href="/"
          className="group inline-flex min-h-(--size-touch) items-center gap-2.5 rounded-(--radius-md) pr-2"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-(--radius-md) bg-surface-inverse text-(length:--text-sm) font-bold tracking-tight text-fg-inverse shadow-(--shadow-sm) transition-transform duration-(--duration-fast) ease-(--ease-out-expo) group-hover:scale-[1.03]"
          >
            TS
          </span>
          <span className="text-(length:--text-lg) font-semibold tracking-tight text-fg">
            TechStore
          </span>
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="order-3 flex w-full items-center gap-0.5 overflow-x-auto sm:order-0 sm:w-auto"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-(--size-touch) shrink-0 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {children ? (
          <div className="min-w-0 flex-1 sm:max-w-xs sm:flex-none sm:ml-auto">{children}</div>
        ) : null}

        <Link
          href="/cart"
          className="ml-auto inline-flex min-h-(--size-touch) items-center gap-2 rounded-(--radius-full) border border-border bg-surface-raised px-3.5 text-(length:--text-sm) font-medium text-fg shadow-(--shadow-sm) transition-all duration-(--duration-fast) hover:border-border-strong hover:shadow-(--shadow-md) sm:ml-0"
        >
          <span aria-hidden="true" className="text-base leading-none">
            🛒
          </span>
          <span>Giỏ hàng</span>
          {cartCount > 0 ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-(length:--text-xs) font-semibold tabular-nums text-accent-fg">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  )
}
