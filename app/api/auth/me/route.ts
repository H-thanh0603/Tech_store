import { NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/supabase/auth-server'

// Minimal identity for the header account badge. Returns 200 with
// user: null when not signed in so the client can render the same
// component for both states without a 401 round trip.
export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json(
      { user: null },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return NextResponse.json(
    {
      user: {
        email: user.email ?? null,
        fullName:
          (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
