/**
 * Admin module permissions.
 *
 * Current auth is a single shared ADMIN_SECRET session (role = "admin").
 * This map is centralized so sidebar and server guards never hard-code
 * permission checks inline. Multi-role staff can plug in later without
 * rewriting UI components.
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
    'customers',
    'coupons',
    'reports',
  ],
  staff: ['dashboard', 'products', 'inventory', 'orders', 'customers'],
}

/** Session today always maps to full admin. */
export const DEFAULT_ADMIN_ROLE: AdminRole = 'admin'

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
