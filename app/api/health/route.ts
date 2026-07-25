import { NextResponse } from 'next/server'

/**
 * Public health probe for deploy platforms and uptime checks.
 * Intentionally does not touch the database or secrets.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'techstore',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
