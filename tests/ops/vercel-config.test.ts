import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Vercel operations config', () => {
  it('schedules reservation expiry and notification delivery', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }

    expect(config.crons).toEqual([
      { path: '/api/cron/release-expired-reservations', schedule: '*/5 * * * *' },
      { path: '/api/cron/process-notifications', schedule: '*/5 * * * *' },
      { path: '/api/cron/purge-logs', schedule: '0 18 * * *' },
    ])
  })
})
