import { NextResponse, type NextRequest } from 'next/server'
import type { PostgrestError } from '@supabase/supabase-js'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isJevEnabled, jevApi, jevLastError, jevModel } from '@/lib/assistant/jev'

/** JEV decision-layer status: enabled/transport/model + last failure (if any). */
function jevStatus() {
  if (!isJevEnabled()) return { enabled: false }
  const error = jevLastError()
  return { enabled: true, api: jevApi(), model: jevModel(), ...(error ? { lastError: error } : {}) }
}

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
  const requestId = request?.headers.get('x-request-id') ?? crypto.randomUUID()
  const baseHeaders = { 'Cache-Control': 'no-store', 'x-request-id': requestId }
  if (!wantsDb) {
    const jev = jevStatus()
    return NextResponse.json(
      {
        ok: true,
        service: 'techstore',
        timestamp: new Date().toISOString(),
        jev,
        // Degraded but alive: chat runs on keyword fallback while JEV fails.
        degraded: 'lastError' in jev,
      },
      {
        status: 200,
        headers: baseHeaders,
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
      { status: 503, headers: baseHeaders },
    )
  }

  const start = Date.now()
  // Bounded so a hung/paused Supabase project can never wedge the liveness probe
  // (or the ?check=db smoke test). Any network/DB failure collapses to 503 with
  // db:'unreachable', which is the intended fail-open shape.
  let result: { count: number | null; error: PostgrestError | null }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4_000)
    result = await getSupabaseServerClient()
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .abortSignal(ctrl.signal)
    clearTimeout(t)
  } catch {
    // Includes AbortError → treat as unreachable so callers see 503, not a hang.
    return NextResponse.json(
      {
        ok: false,
        service: 'techstore',
        db: 'unreachable',
        message: 'Supabase query timed out or rejected the request.',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: baseHeaders },
    )
  }
  const { error } = result
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
      { status: 503, headers: baseHeaders },
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
    { status: 200, headers: baseHeaders },
  )
}
