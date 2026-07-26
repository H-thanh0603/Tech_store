import type { ReactNode } from 'react'

import { AdminShell } from '@/components/admin/shell/admin-shell'
import { getAdminSession } from '@/lib/admin/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession()

  if (!session) {
    // Login (and any unauthenticated admin page) — no shell chrome.
    return (
      <div className="flex min-h-screen flex-col bg-surface text-fg">
        <main className="container-store flex flex-1 flex-col justify-center py-10">{children}</main>
      </div>
    )
  }

  return <AdminShell role={session.role}>{children}</AdminShell>
}
