import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

/**
 * CSV import: empty submit shows the inline error; pasting a valid row
 * creates/updates a product visible in the admin list.
 */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'
const ADMIN_TOTP_SECRET = readFileSync('.admin-e2e-mfa-secret', 'utf8').trim()

const slug = `e2e-csv-${Date.now()}`

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

test.describe.serial('admin CSV import', () => {
  test('empty submit shows the inline error', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/import')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Dán nội dung CSV vào ô bên dưới trước khi nhập.')).toBeVisible()
  })

  test('a valid row is imported and listed', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/import')
    await page.getByLabel('Dán CSV (có dòng tiêu đề)').fill(
      `slug,name,category_slug,brand_slug,description,is_published,is_featured,is_archived,variant_sku,variant_attributes,variant_regular_price,variant_sale_price,variant_stock\n` +
        `${slug},E2E CSV ${slug},phone,apple,CSV e2e row,true,false,false,E2E-CSV-${slug},"{""ram"": ""8GB""}",1000000,,5`,
    )
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText(/tạo mới 1|cập nhật 1/, { exact: false }).first()).toBeVisible({
      timeout: 15000,
    })

    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    await expect(page.getByText(`E2E CSV ${slug}`).first()).toBeVisible({ timeout: 10000 })
  })

  test('a bad row is rejected with reasons', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/import')
    await page.getByLabel('Dán CSV (có dòng tiêu đề)').fill(
      `slug,name,category_slug,brand_slug\nbad-row,,phone,apple`,
    )
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText(/bị từ chối 1/, { exact: false }).first()).toBeVisible({
      timeout: 15000,
    })
  })
})
