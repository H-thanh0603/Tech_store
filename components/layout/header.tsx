import Link from 'next/link'
import type { ReactNode } from 'react'

interface HeaderProps {
  children?: ReactNode
}

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/products', label: 'Sản phẩm' },
  { href: '/compare', label: 'So sánh' },
]

export function Header({ children }: HeaderProps) {
  return (
    <header className="border-b border-border bg-surface-raised">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-(length:--text-lg) font-semibold tracking-tight text-fg"
        >
          TechStore
        </Link>
        <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-(--size-touch) items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-muted hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {children ? <div className="ml-auto min-w-0 flex-1 sm:max-w-xs">{children}</div> : null}
      </div>
    </header>
  )
}
