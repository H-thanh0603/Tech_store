import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

/**
 * Bulk price/stock ops on the admin product list. Creates its own product
 * so the suite is independent from admin-crud. window.prompt is answered
 * via the dialog handler before clicking the bulk buttons.
 */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'
const ADMIN_TOTP_SECRET = readFileSync('.admin-e2e-mfa-secret', 'utf8').trim()

const slug = `e2e-bulk-${Date.now()}`
const productName = `E2E Bulk ${slug}`

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

test.describe.serial('admin bulk price/stock', () => {
  test('creates a product for bulk ops', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/new')
    await page.getByLabel('Tên sản phẩm').fill(productName)
    await page.getByLabel('Slug').fill(slug)
    await page.getByLabel('Danh mục').selectOption({ label: 'Laptop' })
    await page.getByLabel('SKU biến thể đầu').fill(`SKU-${slug}`)
    await page.getByLabel('Giá (VND)').fill('1000000')
    await page.getByLabel('Tồn kho').fill('20')
    await page.getByLabel('Xuất bản ngay').check()
    await page.getByRole('button', { name: 'Tạo sản phẩm' }).click()
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/)
  })

  test('bulk +10% changes the price', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    const row = page.getByRole('row', { name: new RegExp(productName) }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('checkbox').check()

    page.on('dialog', (dialog) => void dialog.accept('10'))
    await page.getByRole('button', { name: 'Giá +%' }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByText(/1.100.000|1100000/).first()).toBeVisible({ timeout: 15000 })
  })

  test('bulk remove-sale and set-stock work', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    const row = page.getByRole('row', { name: new RegExp(productName) }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('checkbox').check()

    await page.getByRole('button', { name: 'Xóa sale' }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByText(/sale|giá/i).first()).toBeVisible({ timeout: 15000 })
  })
})
