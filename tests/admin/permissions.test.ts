import { describe, expect, it } from 'vitest'

import { navItemsForRole } from '@/lib/admin/nav-config'
import {
  canAccessModule,
  modulesForRole,
  requireModuleAccess,
} from '@/lib/admin/permissions'

describe('admin permissions', () => {
  it('gives admin full module access', () => {
    expect(modulesForRole('admin')).toContain('settings')
    expect(canAccessModule('admin', 'coupons')).toBe(true)
    expect(canAccessModule('admin', 'reports')).toBe(true)
  })

  it('hides manager from settings', () => {
    expect(canAccessModule('manager', 'settings')).toBe(false)
    expect(canAccessModule('manager', 'orders')).toBe(true)
  })

  it('limits staff modules', () => {
    expect(canAccessModule('staff', 'coupons')).toBe(false)
    expect(canAccessModule('staff', 'products')).toBe(true)
    expect(canAccessModule('staff', 'orders')).toBe(true)
    expect(canAccessModule('staff', 'categories')).toBe(false)
  })

  it('throws FORBIDDEN when requireModuleAccess fails', () => {
    expect(() => requireModuleAccess('staff', 'settings')).toThrow('FORBIDDEN')
    expect(() => requireModuleAccess('admin', 'dashboard')).not.toThrow()
  })

  it('filters sidebar nav by role', () => {
    const staffNav = navItemsForRole('staff')
    const labels = staffNav.map((item) => item.module)
    expect(labels).toContain('dashboard')
    expect(labels).toContain('orders')
    expect(labels).not.toContain('coupons')
    expect(labels).not.toContain('settings')

    const adminNav = navItemsForRole('admin')
    expect(adminNav.length).toBeGreaterThan(staffNav.length)
    expect(adminNav.map((i) => i.module)).toContain('settings')
  })
})
