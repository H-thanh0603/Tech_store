'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'

type HeaderProps = {
  children?: ReactNode
  cartCount?: number
}

const UTILITY = [
  { href: '/track-order', label: 'Tra cứu đơn' },
  { href: '/products', label: 'Hỗ trợ chọn máy' },
  { href: '/#trust', label: 'Bảo hành & giao hàng' },
]

const CATEGORIES = [
  { href: '/products?category=laptop', label: 'Laptop' },
  { href: '/products?category=dien-thoai', label: 'Điện thoại' },
  { href: '/products?useCase=gaming', label: 'Gaming' },
  { href: '/products?category=phu-kien', label: 'Phụ kiện' },
  { href: '/products', label: 'Khuyến mãi' },
  { href: '/#need-selector', label: 'Tư vấn' },
]

export function Header({ children, cartCount = 0 }: HeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur-md">
      {/* Utility bar — desktop */}
      <div className="hidden border-b border-border bg-bg-secondary md:block">
        <div className="container-store flex items-center justify-between gap-4 py-2 text-(length:--text-xs) text-fg-muted">
          <p className="font-medium tracking-wide">
            Chính hãng · Giá rõ · Guest checkout · Theo dõi đơn dễ dàng
          </p>
          <nav aria-label="Tiện ích" className="flex items-center gap-4">
            {UTILITY.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-fg">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main header */}
      <div className="container-store flex items-center gap-3 py-3">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) border border-border text-fg lg:hidden"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <Link href="/" className="group inline-flex min-h-11 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-(--radius-md) bg-surface-inverse text-(length:--text-sm) font-bold tracking-tight text-fg-inverse"
          >
            TS
          </span>
          <span className="text-(length:--text-lg) font-semibold tracking-tight text-fg">
            TechStore
          </span>
        </Link>

        <form
          onSubmit={onSearch}
          role="search"
          className="ml-2 hidden min-w-0 flex-1 md:block lg:max-w-xl"
        >
          <label htmlFor="header-search" className="sr-only">
            Tìm sản phẩm
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="header-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm laptop, điện thoại, phụ kiện…"
              className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary pl-10 pr-24 text-(length:--text-sm) text-fg shadow-(--shadow-sm) placeholder:text-fg-subtle focus-visible:border-brand"
            />
            <button
              type="submit"
              className="absolute inset-y-1 right-1 rounded-(--radius-sm) bg-brand px-3 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
            >
              Tìm
            </button>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          {children}
          <Link
            href="/track-order"
            className="hidden min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg sm:inline-flex"
          >
            Đơn hàng
          </Link>
          <Link
            href="/cart"
            className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border bg-bg-elevated px-3 text-(length:--text-sm) font-semibold text-fg shadow-(--shadow-sm) transition-colors hover:border-border-strong"
          >
            <span aria-hidden>🛒</span>
            <span className="hidden sm:inline">Giỏ</span>
            {cartCount > 0 ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-(length:--text-xs) font-semibold tabular-nums text-accent-fg">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Category nav — desktop */}
      <nav
        aria-label="Danh mục"
        className="hidden border-t border-border lg:block"
      >
        <div className="container-store flex items-center gap-1 overflow-x-auto py-1">
          {CATEGORIES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="border-t border-border bg-bg-elevated lg:hidden">
          <form onSubmit={onSearch} role="search" className="container-store py-3">
            <label htmlFor="mobile-search" className="sr-only">
              Tìm sản phẩm
            </label>
            <input
              id="mobile-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sản phẩm…"
              className="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm)"
            />
          </form>
          <nav aria-label="Menu mobile" className="container-store flex flex-col gap-1 pb-4">
            <p className="px-1 pb-1 text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
              Danh mục
            </p>
            {CATEGORIES.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            {UTILITY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
