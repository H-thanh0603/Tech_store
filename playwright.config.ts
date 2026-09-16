import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'admin-setup',
      testMatch: /admin\.setup\.ts/,
    },
    {
      // No credentials: guest flows + redirect guards. Must NOT inherit the
      // admin storageState, or guest-redirect assertions see a session.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /admin-(crud|csv-import|bulk-price|returns)\.spec\.ts/,
    },
    {
      // Single shared admin session from admin-setup (MFA verify is
      // fail-closed 10/15min — per-test logins burn the bucket and flake).
      name: 'chromium-admin',
      use: { ...devices['Desktop Chrome'], storageState: 'test-results/.admin-auth.json' },
      testMatch: /admin-(crud|csv-import|bulk-price|returns)\.spec\.ts/,
      dependencies: ['admin-setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testIgnore: /admin-(setup|crud|csv-import|bulk-price|returns)\.spec\.ts/,
    },
  ],
  webServer: {
    // Admin login needs a seeded Supabase account: `npm run admin:seed`
    // (idempotent) against the local stack before running this suite.
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
