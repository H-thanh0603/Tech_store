// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdminCommandPalette } from '@/components/admin/shell/admin-command-palette'
import { navItemsForRole } from '@/lib/admin/nav-config'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const items = navItemsForRole('admin')

describe('AdminCommandPalette', () => {
  it('opens on slash and matches nav items', async () => {
    const user = userEvent.setup()
    render(<AdminCommandPalette items={items} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.keyboard('/')
    expect(screen.getByRole('dialog', { name: 'Tìm kiếm admin' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Tìm kiếm admin' }), 'đơn')
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Đơn hàng/i })).toBeInTheDocument()
    })
  })

  it('toggles on Cmd+K and closes on Escape', async () => {
    const user = userEvent.setup()
    render(<AdminCommandPalette items={items} />)

    await user.keyboard('{Meta>}k{/Meta}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('queries the search API after 2 chars', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [], products: [], customers: [] }),
    } as Response)
    const user = userEvent.setup()
    render(<AdminCommandPalette items={items} />)

    await user.keyboard('/')
    await user.type(screen.getByRole('textbox', { name: 'Tìm kiếm admin' }), 'TS-')
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/admin/search?q=TS-'))
    })
    fetchSpy.mockRestore()
  })
})
