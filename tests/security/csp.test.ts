import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { proxy } from '@/proxy'

describe('Content Security Policy', () => {
  it('uses a per-request script nonce without unsafe script directives', async () => {
    const response = await proxy(new NextRequest('https://techstore.test/products'))
    const csp = response.headers.get('content-security-policy') ?? ''

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/)
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('locks style-src to a nonce and only allows inline style attributes', async () => {
    const response = await proxy(new NextRequest('https://techstore.test/products'))
    const csp = response.headers.get('content-security-policy') ?? ''

    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/)
    expect(csp).not.toMatch(/(^|;)\s*style-src\s[^;]*'unsafe-inline'/)
    expect(csp).toMatch(/style-src-attr 'unsafe-inline'/)
  })

  it('generates a different nonce for each request', async () => {
    const a = await proxy(new NextRequest('https://techstore.test/a'))
    const b = await proxy(new NextRequest('https://techstore.test/b'))
    const nonceA = a.headers.get('content-security-policy')?.match(/nonce-([^']+)/)?.[1]
    const nonceB = b.headers.get('content-security-policy')?.match(/nonce-([^']+)/)?.[1]
    expect(nonceA).toBeTruthy()
    expect(nonceB).toBeTruthy()
    expect(nonceA).not.toBe(nonceB)
  })

  it('restricts connect-src to Supabase and Sentry (no open https:)', async () => {
    const response = await proxy(new NextRequest('https://techstore.test/products'))
    const csp = response.headers.get('content-security-policy') ?? ''
    const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] ?? ''

    expect(connectSrc).toContain("'self'")
    expect(connectSrc).toContain('https://*.supabase.co')
    expect(connectSrc).toContain('https://*.sentry.io')
    expect(connectSrc).not.toMatch(/(^|\s)https:(\s|$)/)
    expect(connectSrc).not.toMatch(/(^|\s)wss:(\s|$)/)
  })
})
