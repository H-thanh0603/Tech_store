import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only privileged client for storefront server actions / route
// handlers that must call service_role-only RPCs (e.g. check_rate_limit
// after DB-051 revoked the anon/authenticated grant).
//
// This lives under lib/supabase (not lib/admin) on purpose: the storefront
// boundary (eslint no-restricted-imports) forbids lib/customer,
// lib/catalog, lib/content and UI code from importing @/lib/admin/*.
// Staff guards and admin CRUD stay in @/lib/admin/supabase.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

let serviceRoleClient: SupabaseClient | null = null

export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  serviceRoleClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return serviceRoleClient
}
