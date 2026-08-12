import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only privileged client for admin catalog reads/writes.
// Never import this into Client Components. Prefer RPCs for multi-row stock
// transitions; use this client for form-driven CRUD with Zod validation.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

let adminClient: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return adminClient
}
