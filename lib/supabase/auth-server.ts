import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cookie-backed Supabase client for customer auth (server components / actions).
 * Prefer this over the plain anon client when the user session matters.
 */
export async function createSupabaseAuthClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component — middleware will refresh session.
          }
        },
      },
    },
  )
}

export async function getAuthUser() {
  const supabase = await createSupabaseAuthClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}
