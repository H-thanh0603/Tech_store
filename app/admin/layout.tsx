import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AdminShell } from '@/components/admin/shell/admin-shell'
import { getAdminSession } from '@/lib/admin/auth'

const PUBLIC_ADMIN_PREFIXES = ['/admin/login', '/admin/mfa']

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession()

  if (!session) {
    // L1: layout-level redirect — per-page requireAdminSession guards stay
    // authoritative, but one forgotten guard no longer renders protected UI
    // publicly. Login/MFA pages keep their chromeless shell.
    const pathname = (await headers()).get('x-pathname') ?? ''
    const isPublic = PUBLIC_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
    if (!isPublic && pathname.startsWith('/admin')) {
      redirect('/admin/login')
    }
    // Login (and any unauthenticated admin page) — no shell chrome.
    return (
      <div className="flex min-h-screen flex-col bg-surface text-fg">
        <main className="container-store flex flex-1 flex-col justify-center py-10">{children}</main>
      </div>
    )
  }

  return <AdminShell role={session.role}>{children}</AdminShell>
}
