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
})
