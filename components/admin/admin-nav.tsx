'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { adminLogout } from '@/lib/admin/auth-actions'
import { Button } from '@/components/ui/button'

const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/products', label: 'Sản phẩm', exact: false },
  { href: '/admin/orders', label: 'Đơn hàng', exact: false },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-4">
      <p className="mr-auto text-(length:--text-sm) font-semibold tracking-tight text-fg">
        TechStore Admin
      </p>
      <nav aria-label="Admin" className="flex flex-wrap gap-1">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium ${
                active
                  ? 'bg-accent-subtle text-accent'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <form action={adminLogout}>
        <Button type="submit" variant="ghost">
          Đăng xuất
        </Button>
      </form>
    </div>
  )
}
