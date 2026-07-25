'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

import { IconGrid, IconHome, IconReceipt, IconSearch, IconUser } from '@/components/ui/icons'
import { openSearch } from '@/lib/customer/search-events'

/**
 * Mobile bottom navigation (DESIGN_CELLPHONES_INSPIRED.md §3.5, §10).
 *
 * Five destinations, the platform maximum before labels stop being readable.
 * `aria-current="page"` marks the active tab so the state is announced, not just
 * coloured, and the bar respects the iOS home-indicator inset via `safe-bottom`.
 *
 * The search tab is a button, not a link: it opens the real search sheet in the
 * header (same component as the desktop suggest), so there is no fake route and
 * no duplicate search implementation.
 */

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

type Tab = {
  href: string
  label: string
  icon: IconComponent
  /** Additional path prefixes that should light this tab up. */
  match?: string[]
}

const TABS: Tab[] = [
  { href: '/', label: 'Trang chủ', icon: IconHome },
  { href: '/products', label: 'Danh mục', icon: IconGrid },
  { href: '/track-order', label: 'Đơn hàng', icon: IconReceipt, match: ['/orders'] },
  { href: '/account', label: 'Tài khoản', icon: IconUser },
]

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === '/') {
    return pathname === '/'
  }
  if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
    return true
  }
  return (tab.match ?? []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

const tabClass =
  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-(length:--text-xs) font-medium transition-colors'

export function BottomNav() {
  const pathname = usePathname() ?? '/'
  const activeHref = TABS.find((tab) => isActive(pathname, tab))?.href ?? null

  return (
    <nav
      aria-label="Điều hướng chính"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-elevated/98 backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.href === activeHref} />
        ))}

        <li>
          <button type="button" onClick={openSearch} className={`${tabClass} text-fg-muted`}>
            <IconSearch size={22} />
            <span className="leading-none">Tìm kiếm</span>
          </button>
        </li>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.href === activeHref} />
        ))}
      </ul>
    </nav>
  )
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon
  return (
    <li>
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={`${tabClass} ${active ? 'text-brand' : 'text-fg-muted hover:text-fg'}`}
      >
        <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
        <span className="leading-none">{tab.label}</span>
      </Link>
    </li>
  )
}
