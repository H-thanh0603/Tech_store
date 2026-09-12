import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { proxy } from '@/proxy'

const ORIGINAL_ENV = { ...process.env }

describe('preview write guard (OPS-003)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  function post(path: string): NextRequest {
    return new NextRequest(`https://techstore.test${path}`, { method: 'POST' })
  }

  it('blocks writes on Vercel preview deployments', async () => {
    process.env.VERCEL_ENV = 'preview'
    delete process.env.ALLOW_PREVIEW_WRITES
    const response = await proxy(post('/checkout'))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('PREVIEW_READ_ONLY')
  })

  it('blocks server-action POSTs to page paths too', async () => {
    process.env.VERCEL_ENV = 'preview'
    delete process.env.ALLOW_PREVIEW_WRITES
    const response = await proxy(post('/products'))
    expect(response.status).toBe(403)
  })

  it('still serves GET requests on preview (read-only browsing works)', async () => {
    process.env.VERCEL_ENV = 'preview'
    delete process.env.ALLOW_PREVIEW_WRITES
    const response = await proxy(new NextRequest('https://techstore.test/products'))
    expect(response.status).not.toBe(403)
    expect(response.headers.get('content-security-policy')).toBeTruthy()
  })

  it('allows writes when ALLOW_PREVIEW_WRITES=1 is set deliberately', async () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.ALLOW_PREVIEW_WRITES = '1'
    const response = await proxy(post('/checkout'))
    expect(response.status).not.toBe(403)
  })

  it('never blocks production or local development', async () => {
    process.env.VERCEL_ENV = 'production'
    const response = await proxy(post('/checkout'))
    expect(response.status).not.toBe(403)
  })
})
