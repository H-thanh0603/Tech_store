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

export function isAdminRole(value: unknown): value is AdminRole {
  return value === 'admin' || value === 'manager' || value === 'staff'
}

export function modulesForRole(role: AdminRole): readonly AdminModule[] {
  return ROLE_MODULES[role]
}

export function canAccessModule(role: AdminRole, module: AdminModule): boolean {
  return ROLE_MODULES[role].includes(module)
}

export function requireModuleAccess(role: AdminRole, module: AdminModule): void {
  if (!canAccessModule(role, module)) {
    throw new Error('FORBIDDEN')
  }
}
