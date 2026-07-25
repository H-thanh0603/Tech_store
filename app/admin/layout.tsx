import type { ReactNode } from 'react'

import { AdminNav } from '@/components/admin/admin-nav'
import { isAdminAuthenticated } from '@/lib/admin/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminAuthenticated()

  return (
    <div className="mx-auto w-full max-w-6xl">
      {authed ? <AdminNav /> : null}
      {children}
    </div>
  )
}
