import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { proxy } from '@/proxy'

/**
 * Q45/Q54/Q137 — proxy hardening: CSRF origin check, global API body cap,
 * preview noindex. Server-to-server callers (no Origin: VNPay IPN, cron)
 * must never be blocked — only a *mismatched* origin is rejected.
 */

const ORIGINAL_ENV = { ...process.env }

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(`https://techstore.test${path}`, init)
}

describe('proxy hardening', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.VERCEL_ENV
    delete process.env.ALLOW_PREVIEW_WRITES
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('blocks state-changing API calls with a foreign Origin (Q45)', async () => {
    const response = await proxy(
      req('/api/cart', { method: 'POST', headers: { origin: 'https://evil.test' } }),
    )
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('CSRF_BLOCKED')
  })

  it('allows the same origin and origin-less callers (VNPay/cron/scripts)', async () => {
    const same = await proxy(
      req('/api/cart', { method: 'POST', headers: { origin: 'https://techstore.test' } }),
    )
    expect(same.status).not.toBe(403)

    const noOrigin = await proxy(req('/api/vnpay/ipn', { method: 'POST' }))
    expect(noOrigin.status).not.toBe(403)
  })

  it('never blocks GET on origin grounds', async () => {
    const response = await proxy(
      req('/products', { headers: { origin: 'https://evil.test' } }),
    )
    expect(response.status).not.toBe(403)
  })

  it('rejects oversized API bodies with 413 (Q54)', async () => {
    const response = await proxy(
      req('/api/analytics/events', {
        method: 'POST',
        headers: { 'content-length': String(20 * 1024 * 1024) },
      }),
    )
    expect(response.status).toBe(413)
  })

  it('sends X-Robots-Tag noindex on preview (Q137)', async () => {
    process.env.VERCEL_ENV = 'preview'
    const response = await proxy(req('/products'))
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })
})
