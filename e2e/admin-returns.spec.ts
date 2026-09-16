import { expect, test, type Page } from '@playwright/test'

import { ensureAdmin } from './admin-auth'

/**
 * Return lifecycle: guest checkout (COD) → admin advances to shipping →
 * guest requests return → admin approves → order shows returned.
 * Needs local Supabase + seeded admin (`node scripts/seed-admin-user.mjs`).
 */
let orderCode = ''
// The order-access token lives in a cookie set at checkout; each test gets
// a fresh browser context, so persist it across the serial suite.
let savedCookies: Array<{ name: string; value: string }> = []

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ts_promo_closed', 'true'))
})

async function advanceTo(page: Page, targetLabel: string) {
  await page.getByRole('button', { name: `→ ${targetLabel}` }).click()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  // Server message uses the status code ("Đã chuyển đơn sang confirmed."),
  // not the label — match the stable prefix.
  await expect(page.getByText(/đã chuyển đơn sang/i, { exact: false })).toBeVisible({
    timeout: 10000,
  })
}

test.describe.serial('return lifecycle: checkout → ship → request → approve', () => {
  test('guest checks out COD', async ({ page }) => {
    // Seed product with stock (clicking through cards one by one crashes
    // the browser under memory pressure; seed slugs are stable).
    await page.goto('/products/dell-xps-13')
    const add = page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).first()
    await expect(add).toBeEnabled({ timeout: 10000 })
    await add.click()
    await expect(page.getByText('Đã thêm vào giỏ', { exact: true })).toBeVisible()

    await page.goto('/cart')
    await page.getByRole('link', { name: 'Đến thanh toán' }).click()
    await page.getByLabel(/Họ và tên/).fill('E2E Return')
    await page.getByLabel(/Số điện thoại/).fill('0909999888')
    await page.getByLabel(/Tỉnh\/thành phố/).fill('TP.HCM')
    await page.getByLabel(/Quận\/huyện/).fill('Quận 1')
    await page.getByLabel(/Phường\/xã/).fill('Bến Nghé')
    await page.getByLabel(/Địa chỉ cụ thể/).fill('1 Nguyễn Huệ')
    await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/[^/]+\/confirmation$/)
    orderCode = new URL(page.url()).pathname.split('/')[2]
    expect(orderCode).toMatch(/^TS-/)
    // Persist the order-access cookie for the later guest test (fresh
    // context per test would otherwise 404 on /orders/[code]).
    savedCookies = (await page.context().cookies()).map((c) => ({ name: c.name, value: c.value }))
  })

  test('admin advances the order to shipping', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await ensureAdmin(page)
    await page.goto(`/admin/orders/${orderCode}`)
    await advanceTo(page, 'Đã xác nhận')
    await advanceTo(page, 'Đang đóng gói')
    await advanceTo(page, 'Đang giao')
  })

  test('guest requests a return from the order page', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await page.context().addCookies(
      savedCookies.map((c) => ({ ...c, url: 'http://127.0.0.1:3000' })),
    )
    await page.goto(`/orders/${orderCode}`)
    // Form is collapsed behind a toggle; phone is a hidden field when the
    // order already has one — only the note needs filling.
    await page.getByRole('button', { name: 'Yêu cầu trả hàng / đổi trả' }).click()
    await page.getByLabel('Ghi chú thêm (tùy chọn)').fill('E2E: hàng lỗi nhẹ')
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click()
    // Success flips the order to return_requested, which unmounts the form
    // (revalidate) — assert the new status chip instead of a toast.
    await expect(page.getByText(/yêu cầu trả hàng/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('admin approves the return', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await ensureAdmin(page)
    await page.goto('/admin/orders/returns?status=requested')
    const row = page.locator('tbody tr', { hasText: orderCode }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('button', { name: 'Xử lý' }).click()
    await page.getByRole('button', { name: 'Duyệt trả hàng' }).click()
    await expect(page.getByText('Đã duyệt').first()).toBeVisible({ timeout: 10000 })
  })
})
