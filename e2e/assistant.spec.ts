import { expect, test } from '@playwright/test'

// Same promo-popup guard as smoke.spec.ts: the popup auto-opens ~1.2s after
// mount and would intercept clicks on the assistant button.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('ts_promo_closed', 'true')
  })
})

test.describe('shopping assistant smoke', () => {
  test('widget button opens the chat panel', async ({ page }) => {
    await page.goto('/')
    const openButton = page.getByRole('button', { name: /mở trợ lý mua sắm/i })
    await expect(openButton).toBeVisible()
    await openButton.click()
    await expect(page.getByLabel('Trợ lý mua sắm TechStore')).toBeVisible()
    await expect(page.getByPlaceholder(/hỏi về máy, giá, đơn hàng/i)).toBeVisible()
  })

  test('chat without a model key replies disabled, not broken', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /mở trợ lý mua sắm/i }).click()
    await page.getByPlaceholder(/hỏi về máy, giá, đơn hàng/i).fill('laptop học tập')
    await page.getByRole('button', { name: /^gửi$/i }).click()
    // No ANTHROPIC_/DEEPSEEK_API_KEY in test env: graceful disabled reply.
    await expect(page.getByText(/chưa được cấu hình/i)).toBeVisible({ timeout: 15_000 })
  })

  test('chat endpoint validates bad bodies', async ({ request }) => {
    const res = await request.post('/api/v1/assistant/chat', { data: { messages: [] } })
    expect(res.status()).toBe(400)
  })
})

test.describe('merchant assistant smoke', () => {
  test('assistant page redirects guests to login', async ({ page }) => {
    await page.goto('/admin/assistant')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('merchant chat rejects unauthenticated callers', async ({ request }) => {
    const res = await request.post('/api/v1/assistant/merchant/chat', {
      data: { messages: [{ role: 'user', content: 'doanh thu?' }] },
    })
    expect([401, 403]).toContain(res.status())
  })
})
