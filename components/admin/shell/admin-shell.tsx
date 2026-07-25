'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/shell/admin-sidebar'
import { AdminTopbar } from '@/components/admin/shell/admin-topbar'
import { MobileNavDrawer } from '@/components/admin/shell/mobile-nav-drawer'
import { ToastProvider } from '@/components/admin/ui/toast-provider'
import { breadcrumbsForPath, navItemsForRole, pageTitleForPath } from '@/lib/admin/nav-config'
import type { AdminRole } from '@/lib/admin/permissions'

const COLLAPSE_KEY = 'techstore-admin-sidebar-collapsed'

type AdminShellProps = {
  role: AdminRole
  children: ReactNode
}

export function AdminShell({ role, children }: AdminShellProps) {
  const pathname = usePathname()
  const items = useMemo(() => navItemsForRole(role), [role])
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const openMobileNav = useCallback(() => setMobileOpen(true), [])
  const closeMobileNav = useCallback(() => setMobileOpen(false), [])

  const title = pageTitleForPath(pathname)
  const breadcrumbs = breadcrumbsForPath(pathname)

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface text-fg">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface-raised transition-[width] duration-200 lg:block ${
            collapsed ? 'w-[4.5rem]' : 'w-64'
          }`}
        >
          <AdminSidebar
            items={items}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            variant="desktop"
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            title={title}
            breadcrumbs={breadcrumbs}
            role={role}
            onOpenMobileNav={openMobileNav}
          />
          <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>

        <MobileNavDrawer open={mobileOpen} onClose={closeMobileNav} items={items} />
      </div>
    </ToastProvider>
  )
}
