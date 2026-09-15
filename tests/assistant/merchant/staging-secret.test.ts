import { afterEach, describe, expect, it } from 'vitest'

import { stagingSecret } from '@/lib/assistant/merchant/guardrails'

const prev = {
  secret: process.env.ASSISTANT_STAGING_SECRET,
  allowDev: process.env.ALLOW_DEV_STAGING,
}

afterEach(() => {
  if (prev.secret === undefined) delete process.env.ASSISTANT_STAGING_SECRET
  else process.env.ASSISTANT_STAGING_SECRET = prev.secret
  if (prev.allowDev === undefined) delete process.env.ALLOW_DEV_STAGING
  else process.env.ALLOW_DEV_STAGING = prev.allowDev
})

describe('stagingSecret (M3)', () => {
  it('returns the configured secret', () => {
    process.env.ASSISTANT_STAGING_SECRET = 's3cret-configured-value'
    expect(stagingSecret()).toBe('s3cret-configured-value')
  })

  it('uses the dev fallback under VITEST', () => {
    delete process.env.ASSISTANT_STAGING_SECRET
    delete process.env.ALLOW_DEV_STAGING
    expect(stagingSecret()).toBe('dev-only-staging-secret-change-me')
  })

  it('refuses silent fallback outside tests without opt-in', () => {
    delete process.env.ASSISTANT_STAGING_SECRET
    delete process.env.ALLOW_DEV_STAGING
    const vitest = process.env.VITEST
    delete process.env.VITEST
    try {
      expect(() => stagingSecret()).toThrow()
    } finally {
      if (vitest !== undefined) process.env.VITEST = vitest
    }
  })

  it('allows the fallback with explicit ALLOW_DEV_STAGING=1', () => {
    delete process.env.ASSISTANT_STAGING_SECRET
    process.env.ALLOW_DEV_STAGING = '1'
    const vitest = process.env.VITEST
    delete process.env.VITEST
    try {
      expect(stagingSecret()).toBe('dev-only-staging-secret-change-me')
    } finally {
      if (vitest !== undefined) process.env.VITEST = vitest
    }
  })
})
