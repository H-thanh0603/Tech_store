import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client for catalog reads. There is no auth in this
// scope, so the anon key plus RLS is the complete security boundary: the
// browser never receives a write policy and the server only ever reads
// published/active rows. Never import this into a Client Component.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

let client: SupabaseClient | null = null

export function getSupabaseServerClient(): SupabaseClient {
  if (client) {
    return client
  }

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return client
}
