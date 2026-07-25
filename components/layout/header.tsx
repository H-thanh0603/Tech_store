'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import { MiniCart } from '@/components/commerce/mini-cart'
import { SearchSuggest } from '@/components/commerce/search-suggest'
import { useListCounts } from '@/components/commerce/list-toggles'
import type { CartData } from '@/lib/commerce/types'

type HeaderProps = {
  children?: ReactNode
  cart: CartData
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

export function Header({ children, cart }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { wishCount, compareCount } = useListCounts()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur-md">
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

        <SearchSuggest className="ml-2 hidden min-w-0 flex-1 md:block lg:max-w-xl" />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {children}
          <Link
            href="/wishlist"
            className="relative hidden min-h-11 items-center rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg sm:inline-flex"
            aria-label={`Wishlist${wishCount ? `, ${wishCount} sản phẩm` : ''}`}
          >
            ♥
            {wishCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-surface-muted px-1 text-(length:--text-xs) tabular-nums">
                {wishCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/compare"
            className="relative hidden min-h-11 items-center rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg md:inline-flex"
            aria-label={`So sánh${compareCount ? `, ${compareCount} sản phẩm` : ''}`}
          >
            ⇄
            {compareCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-surface-muted px-1 text-(length:--text-xs) tabular-nums">
                {compareCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/track-order"
            className="hidden min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg lg:inline-flex"
          >
            Đơn hàng
          </Link>
          <MiniCart cart={cart} />
        </div>
      </div>

      <nav aria-label="Danh mục" className="hidden border-t border-border lg:block">
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

      {menuOpen ? (
        <div className="border-t border-border bg-bg-elevated lg:hidden">
          <div className="container-store py-3">
            <SearchSuggest
              compact
              onNavigate={() => setMenuOpen(false)}
              inputClassName="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 pl-10 text-(length:--text-sm)"
            />
          </div>
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
            <Link
              href="/wishlist"
              onClick={() => setMenuOpen(false)}
              className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              Wishlist {wishCount > 0 ? `(${wishCount})` : ''}
            </Link>
            <Link
              href="/compare"
              onClick={() => setMenuOpen(false)}
              className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              So sánh {compareCount > 0 ? `(${compareCount})` : ''}
            </Link>
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
