import { expect, test as setup } from '@playwright/test'

import { loginAsAdmin } from './admin-auth'

const authFile = 'test-results/.admin-auth.json'

/**
 * Single admin login for the whole E2E suite. The MFA verify path is
 * fail-closed at 10 attempts / 15 min (SEC-003) — every spec logging in
 * per-test burns the shared bucket and flakes the suite at 14 logins.
 */
setup('authenticate as admin', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ts_promo_closed', 'true'))
  await loginAsAdmin(page)
  await expect(page).toHaveURL(/\/admin$/)
  await page.context().storageState({ path: authFile })
})
