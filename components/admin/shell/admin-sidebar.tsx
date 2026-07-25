'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavIcon } from '@/components/admin/shell/nav-icons'
import { isNavItemActive, type AdminNavItem } from '@/lib/admin/nav-config'

type AdminSidebarProps = {
  items: AdminNavItem[]
  collapsed: boolean
  onToggleCollapse?: () => void
  /** When true, render as permanent mobile-friendly full-width list (drawer content). */
  variant?: 'desktop' | 'drawer'
}

export function AdminSidebar({
  items,
  collapsed,
  onToggleCollapse,
  variant = 'desktop',
}: AdminSidebarProps) {
  const pathname = usePathname()
  const isDrawer = variant === 'drawer'
  const showLabels = isDrawer || !collapsed

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex items-center gap-2 border-b border-border px-3 py-4 ${
          showLabels ? 'justify-between' : 'justify-center'
        }`}
      >
        {showLabels ? (
          <div className="min-w-0">
            <p className="truncate text-(length:--text-sm) font-semibold tracking-tight text-fg">
              TechStore Admin
            </p>
            <p className="truncate text-(length:--text-xs) text-fg-muted">Bảng điều khiển</p>
          </div>
        ) : (
          <span className="text-(length:--text-sm) font-bold text-accent" aria-hidden="true">
            TS
          </span>
        )}
        {!isDrawer && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted hover:text-fg"
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-pressed={collapsed}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              {collapsed ? (
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        ) : null}
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={!showLabels ? item.label : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium transition-colors ${
                    active
                      ? 'bg-accent-subtle text-accent'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                  } ${showLabels ? '' : 'justify-center px-0'}`}
                >
                  <NavIcon module={item.module} />
                  {showLabels ? <span className="truncate">{item.label}</span> : null}
                  {showLabels && item.placeholder ? (
                    <span className="ml-auto rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                      sau
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
