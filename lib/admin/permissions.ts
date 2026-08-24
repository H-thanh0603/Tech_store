/**
 * Admin module permissions.
 *
 * This map is centralized so sidebar and server guards never hard-code
 * permission checks inline.
 */

export type AdminRole = 'admin' | 'manager' | 'staff'

export type AdminModule =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'brands'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'coupons'
  | 'content'
  | 'reports'
  | 'settings'

export type AdminPermission =
  | 'staff.manage'
  | 'inventory.adjust'
  | 'orders.update'
  | 'orders.mark_paid'
  | 'orders.note'

/** Modules each role may open in the admin shell. */
const ROLE_MODULES: Record<AdminRole, readonly AdminModule[]> = {
  admin: [
    'dashboard',
    'products',
    'categories',
    'brands',
    'inventory',
    'orders',
    'customers',
    'coupons',
    'content',
    'reports',
    'settings',
  ],
  manager: [
    'dashboard',
    'products',
    'categories',
    'brands',
    'inventory',
    'orders',
    'coupons',
    'content',
    'reports',
  ],
  staff: ['dashboard', 'inventory', 'orders'],
}

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  admin: [
    'staff.manage',
    'inventory.adjust',
    'orders.update',
    'orders.mark_paid',
    'orders.note',
  ],
  manager: ['inventory.adjust', 'orders.update', 'orders.mark_paid', 'orders.note'],
  staff: ['orders.update', 'orders.note'],
}

export function isAdminRole(value: unknown): value is AdminRole {
  return value === 'admin' || value === 'manager' || value === 'staff'
}

export function modulesForRole(role: AdminRole): readonly AdminModule[] {
  return ROLE_MODULES[role]
}

export function canAccessModule(role: AdminRole, module: AdminModule): boolean {
  return ROLE_MODULES[role].includes(module)
}

export function canPerform(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function requireModuleAccess(role: AdminRole, module: AdminModule): void {
  if (!canAccessModule(role, module)) {
    throw new Error('FORBIDDEN')
  }
}
