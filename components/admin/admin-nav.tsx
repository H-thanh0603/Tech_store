import Link from 'next/link'

import { adminLogout } from '@/lib/admin/auth-actions'
import { Button } from '@/components/ui/button'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Sản phẩm' },
  { href: '/admin/orders', label: 'Đơn hàng' },
]

export function AdminNav() {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-4">
      <p className="mr-auto text-(length:--text-sm) font-semibold tracking-tight text-fg">
        TechStore Admin
      </p>
      <nav aria-label="Admin" className="flex flex-wrap gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-10 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={adminLogout}>
        <Button type="submit" variant="ghost">
          Đăng xuất
        </Button>
      </form>
    </div>
  )
}
