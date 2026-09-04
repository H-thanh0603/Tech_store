import type { AdminModule, AdminRole } from '@/lib/admin/permissions'
import { canAccessModule } from '@/lib/admin/permissions'

export type AdminNavItem = {
  href: string
  label: string
  module: AdminModule
  /** Match path exactly (dashboard) vs prefix. */
  exact?: boolean
  /** True when the route is shell-only until a later phase. */
  placeholder?: boolean
}

/**
 * Canonical admin sidebar order. Icons are resolved in the shell component
 * by `module` key so config stays serializable.
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin', label: 'Tổng quan', module: 'dashboard', exact: true },
  { href: '/admin/products', label: 'Sản phẩm', module: 'products' },
  { href: '/admin/categories', label: 'Danh mục', module: 'categories' },
  { href: '/admin/brands', label: 'Thương hiệu', module: 'brands' },
  { href: '/admin/inventory', label: 'Tồn kho', module: 'inventory' },
  { href: '/admin/orders', label: 'Đơn hàng', module: 'orders' },
  { href: '/admin/orders/returns', label: 'Trả hàng', module: 'orders' },
  { href: '/admin/customers', label: 'Khách hàng', module: 'customers' },
  { href: '/admin/coupons', label: 'Khuyến mãi', module: 'coupons' },
  { href: '/admin/content', label: 'Nội dung', module: 'content' },
  { href: '/admin/reports', label: 'Báo cáo', module: 'reports' },
  { href: '/admin/assistant', label: 'Trợ lý AI', module: 'assistant' },
  { href: '/admin/settings', label: 'Cài đặt', module: 'settings' },
] as const

export function navItemsForRole(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => canAccessModule(role, item.module))
}

export function isNavItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function breadcrumbsForPath(pathname: string): Array<{ href?: string; label: string }> {
  const crumbs: Array<{ href?: string; label: string }> = [{ href: '/admin', label: 'Admin' }]

  if (pathname === '/admin' || pathname === '/admin/') {
    crumbs.push({ label: 'Tổng quan' })
    return crumbs
  }

  const match = ADMIN_NAV_ITEMS.find(
    (item) => !item.exact && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )

  if (match) {
    crumbs.push({ href: match.href, label: match.label })
    if (pathname !== match.href) {
      if (pathname.endsWith('/new')) {
        crumbs.push({ label: 'Tạo mới' })
      } else {
        crumbs.push({ label: 'Chi tiết' })
      }
    }
    return crumbs
  }

  crumbs.push({ label: 'Trang' })
  return crumbs
}

export function pageTitleForPath(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Tổng quan'
  const match = ADMIN_NAV_ITEMS.find(
    (item) => !item.exact && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )
  if (!match) return 'Admin'
  if (pathname.endsWith('/new')) return `${match.label} · Tạo mới`
  if (pathname !== match.href) return `${match.label} · Chi tiết`
  return match.label
}
