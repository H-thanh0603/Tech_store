'use client'

import { AdminAccountMenu } from '@/components/admin/shell/admin-account-menu'
import { AdminBreadcrumbs, type BreadcrumbItem } from '@/components/admin/shell/admin-breadcrumbs'
import { EnvironmentBadge } from '@/components/admin/shell/environment-badge'
import type { AdminRole } from '@/lib/admin/permissions'

type AdminTopbarProps = {
  title: string
  breadcrumbs: BreadcrumbItem[]
  role: AdminRole
  onOpenMobileNav: () => void
}

export function AdminTopbar({ title, breadcrumbs, role, onOpenMobileNav }: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) border border-border bg-surface-raised text-fg lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Mở menu điều hướng"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <AdminBreadcrumbs items={breadcrumbs} />
          <h1 className="truncate text-(length:--text-lg) font-semibold tracking-tight text-fg">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <EnvironmentBadge />
          <AdminAccountMenu role={role} />
        </div>
      </div>
    </header>
  )
}
