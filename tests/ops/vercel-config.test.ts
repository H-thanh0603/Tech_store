import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Vercel operations config', () => {
  it('schedules reservation expiry and notification delivery', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }

    // Vercel Hobby allows max 2 crons (OPS-002). Health job inlines
    // release + notifications + abandoned, so we keep only 2 schedules.
    expect(config.crons).toEqual([
      { path: '/api/cron/health', schedule: '*/5 * * * *' },
      { path: '/api/cron/purge-logs', schedule: '0 18 * * *' },
    ])
    expect((config.crons?.length ?? 0) <= 2).toBe(true)
  })
})
