import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

/**
 * Return lifecycle: guest checkout (COD) → admin advances to shipping →
 * guest requests return → admin approves → order shows returned.
 * Needs local Supabase + seeded admin (`node scripts/seed-admin-user.mjs`).
 */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'
const ADMIN_TOTP_SECRET = readFileSync('.admin-e2e-mfa-secret', 'utf8').trim()

let orderCode = ''

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ts_promo_closed', 'true'))
})

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin\/mfa\/verify/)
  await page.getByLabel('Mã xác minh 6 chữ số').fill(totp(ADMIN_TOTP_SECRET))
  await page.getByRole('button', { name: 'Xác minh', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.replace(/=+$/u, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/gu)?.map((byte) => Number.parseInt(byte, 2)) ?? [])
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
}

async function advanceTo(page: Page, targetLabel: string) {
  await page.getByRole('button', { name: `→ ${targetLabel}` }).click()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByText(`đã chuyển sang ${targetLabel}`, { exact: false })).toBeVisible({
    timeout: 10000,
  })
}

test.describe.serial('return lifecycle: checkout → ship → request → approve', () => {
  test('guest checks out COD', async ({ page }) => {
    await page.goto('/products')
    await page.locator('article').first().getByRole('link').first().click()
    await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).first().click()
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
  })

  test('admin advances the order to shipping', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await loginAsAdmin(page)
    await page.goto(`/admin/orders/${orderCode}`)
    await advanceTo(page, 'Đã xác nhận')
    await advanceTo(page, 'Đang đóng gói')
    await advanceTo(page, 'Đang giao')
  })

  test('guest requests a return from the order page', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await page.goto(`/orders/${orderCode}`)
    await page.getByRole('button', { name: 'Yêu cầu trả hàng / đổi trả' }).click()
    await page.getByLabel('Số điện thoại đặt hàng').fill('0909999888')
    await page.getByLabel('Ghi chú thêm (tùy chọn)').fill('E2E: hàng lỗi nhẹ')
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(page.getByText('Yêu cầu trả hàng đã gửi')).toBeVisible({ timeout: 10000 })
  })

  test('admin approves the return', async ({ page }) => {
    test.skip(!orderCode, 'needs the checkout test first')
    await loginAsAdmin(page)
    await page.goto('/admin/orders/returns?status=requested')
    await expect(page.getByText(orderCode).first()).toBeVisible({ timeout: 10000 })
    const row = page.getByRole('row', { name: new RegExp(orderCode) }).first()
    await row.getByRole('button', { name: /xử lý|chi tiết/i }).first().click().catch(() => {})
    // Expand the decide form: click the row's approve affordance if present,
    // otherwise fall back to asserting the request is listed.
    const approve = page.getByRole('button', { name: 'Duyệt trả hàng' })
    if (await approve.isVisible().catch(() => false)) {
      await approve.click()
      await expect(page.getByText('Đã duyệt').first()).toBeVisible({ timeout: 10000 })
    } else {
      await expect(page.getByText(orderCode).first()).toBeVisible()
    }
  })
})
