import { describe, expect, it } from 'vitest'

import { appMetadata } from '@/lib/app-metadata'

describe('app shell', () => {
  it('exposes TechStore metadata', () => {
    expect(appMetadata.title).toContain('TechStore')
  })
})
