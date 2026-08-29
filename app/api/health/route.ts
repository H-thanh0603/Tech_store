import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Public health probe for deploy platforms and uptime checks.
 *
 * - `GET /api/health`              - liveness only, never touches the database
 * - `GET /api/health?check=db`     - exercises a real Supabase query (anon + RLS)
 *                                    so a paused/throttled free-tier project is
 *                                    reported as 503 instead of false-ok.
 *
 * The DB check is intentionally cheap: a `head + count` over the smallest
 * anon-readable table. It fails open if the env is misconfigured so the
 * liveness probe never wedges the deploy.
 */
export async function GET(request?: NextRequest) {
  const wantsDb = request?.nextUrl.searchParams.get('check') === 'db'
  if (!wantsDb) {
    return NextResponse.json(
      {
        ok: true,
        service: 'techstore',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        service: 'techstore',
        db: 'misconfigured',
        message: 'Supabase env is missing.',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const start = Date.now()
  const { error } = await getSupabaseServerClient()
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
  const latencyMs = Date.now() - start

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'techstore',
        db: 'unreachable',
        code: error.code ?? null,
        message: error.message,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      service: 'techstore',
      db: 'ok',
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
