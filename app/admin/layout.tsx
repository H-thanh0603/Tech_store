import type { ReactNode } from 'react'

import { AdminShell } from '@/components/admin/shell/admin-shell'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { DEFAULT_ADMIN_ROLE } from '@/lib/admin/permissions'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminAuthenticated()

  if (!authed) {
    // Login (and any unauthenticated admin page) — no shell chrome.
    return (
      <div className="flex min-h-screen flex-col bg-surface text-fg">
        <main className="container-store flex flex-1 flex-col justify-center py-10">{children}</main>
      </div>
    )
  }

  return <AdminShell role={DEFAULT_ADMIN_ROLE}>{children}</AdminShell>
}
