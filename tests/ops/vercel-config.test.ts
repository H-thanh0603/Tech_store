import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Vercel operations config', () => {
  it('schedules reservation expiry and notification delivery', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }

    // Vercel Hobby allows max 2 crons, daily cadence only (OPS-002, verified
    // 2026-09-12: deploy rejects "*/5 * * * *" on Hobby). The 15-minute
    // cadence for health/inline tasks comes from .github/workflows/monitor.yml
    // (cron */15 pinging /api/cron/health with CRON_SECRET); the Vercel
    // schedules below are daily fallbacks only.
    expect(config.crons).toEqual([
      { path: '/api/cron/health', schedule: '0 6 * * *' },
      { path: '/api/cron/purge-logs', schedule: '0 18 * * *' },
    ])
    expect((config.crons?.length ?? 0) <= 2).toBe(true)
  })
})
