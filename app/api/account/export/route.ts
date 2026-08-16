import { NextResponse } from 'next/server'

import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

// GDPR data portability: download all customer data as JSON. Authenticated via
// the cookie session; the RPC only returns the caller's own rows.
export async function GET() {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('customer_export_my_data')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const result = data as { code?: string } | null
  if (result?.code !== 'OK') {
    return NextResponse.json({ error: 'export_failed' }, { status: 500 })
  }

  return new NextResponse(JSON.stringify(result, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="techstore-data-export.json"',
    },
  })
}
