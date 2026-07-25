// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdminShell } from '@/components/admin/shell/admin-shell'
import { AdminSidebar } from '@/components/admin/shell/admin-sidebar'
import { MobileNavDrawer } from '@/components/admin/shell/mobile-nav-drawer'
import { navItemsForRole } from '@/lib/admin/nav-config'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
}))

vi.mock('@/lib/admin/auth-actions', () => ({
  adminLogout: vi.fn(),
}))

describe('AdminSidebar permissions', () => {
  it('renders admin modules including settings', () => {
    const items = navItemsForRole('admin')
    render(<AdminSidebar items={items} collapsed={false} />)

    const nav = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(nav).getByRole('link', { name: /Sản phẩm/i })).toHaveAttribute(
      'href',
      '/admin/products',
    )
    expect(within(nav).getByRole('link', { name: /Cài đặt/i })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Sản phẩm/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('hides modules staff cannot access', () => {
    const items = navItemsForRole('staff')
    render(<AdminSidebar items={items} collapsed={false} />)

    const nav = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(nav).getByRole('link', { name: /Đơn hàng/i })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /Khuyến mãi/i })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /Cài đặt/i })).not.toBeInTheDocument()
  })
})

describe('AdminShell', () => {
  it('renders shell chrome with role admin', () => {
    render(
      <AdminShell role="admin">
        <p>Nội dung dashboard</p>
      </AdminShell>,
    )

    expect(screen.getByText('Nội dung dashboard')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sản phẩm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mở menu tài khoản|Admin/i })).toBeInTheDocument()
  })
})

describe('MobileNavDrawer', () => {
  it('opens and closes with accessible dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const items = navItemsForRole('admin')

    const { rerender } = render(
      <MobileNavDrawer open={false} onClose={onClose} items={items} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<MobileNavDrawer open onClose={onClose} items={items} />)

    const dialog = screen.getByRole('dialog', { name: 'Menu admin' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Tổng quan/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đóng menu' }))
    expect(onClose).toHaveBeenCalled()
  })
})
