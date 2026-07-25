import { afterEach, describe, expect, it } from 'vitest'

import { getSiteUrl } from '@/lib/site'

const ORIGINALS = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercel: process.env.VERCEL_URL,
}

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINALS.site
  process.env.VERCEL_URL = ORIGINALS.vercel
})

describe('getSiteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example/'
    process.env.VERCEL_URL = 'other.vercel.app'
    expect(getSiteUrl()).toBe('https://shop.example')
  })

  it('falls back to localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_URL
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })
})
