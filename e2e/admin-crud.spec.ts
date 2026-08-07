import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ok } from 'node:assert'

import { expect, test, type Page } from '@playwright/test'

/**
 * Mint the `techstore_admin` HMAC session cookie so admin pages treat this
 * browser as logged in (legacy-secret mode; dev server only). The format
 * mirrors lib/admin/auth.ts createAdminSessionToken, but we re-implement it
 * here with node:crypto instead of importing that module, which pulls in
 * next/headers and is unusable under Playwright's plain Node context.
 */
function mintAdminCookie(secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12
  const nonce = randomBytes(16).toString('base64url')
  const body = `${exp}.${nonce}`
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}

/**
 * The admin server reads its secret from env (CI) or from .env.local (local
 * dev). Playwright's own process does NOT inherit .env.local, so read the
 * file directly to mint a cookie with the exact secret the local dev server
 * loaded — otherwise verification fails with a signature mismatch.
 */
function adminSecret(): string {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET
  const raw = readFileSync('.env.local', 'utf8')
  const m = raw.match(/^ADMIN_SECRET=(.*)$/m)
  if (!m) throw new Error('ADMIN_SECRET missing: set env or .env.local')
  return m[1].replace(/^["']|["']$/g, '')
}

const ADMIN_SECRET = adminSecret()
ok(ADMIN_SECRET.length >= 16, 'ADMIN_SECRET must be at least 16 chars')

// Unique per run; shared across the serial suite below.
const slug = `e2e-admin-${Date.now()}`
const productName = `E2E Admin ${slug}`
const sku = `SKU-${slug}`
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

async function loginAsAdmin(page: Page, url: string) {
  await page.context().addCookies([
    { name: 'techstore_admin', value: mintAdminCookie(ADMIN_SECRET), url },
  ])
}

// One serial suite: the inventory tests depend on the product the create tests
// make. Playwright runs separate `describe.serial` blocks in parallel even in
// the same file (fullyParallel + multiple workers), so keep every test here —
// shipping the whole flow in order is the point of this spec.
test.describe.serial('admin CRUD: create product → storefront → adjust inventory', () => {
  test('minted cookie reaches the admin products page', async ({ page }) => {
    await loginAsAdmin(page, baseURL)
    await page.goto('/admin/products')
    await expect(page).toHaveURL(/\/admin\/products/)
    await expect(page.getByRole('link', { name: /\+ Sản phẩm mới/i })).toBeVisible()
  })

  test('create product form creates it and lands on the edit page', async ({ page }) => {
    await loginAsAdmin(page, baseURL)
    await page.goto('/admin/products/new')
    await page.getByLabel('Tên sản phẩm').fill(productName)
    await page.getByLabel('Slug').fill(slug)
    await page.getByLabel('Danh mục').selectOption({ label: 'Laptop' })
    await page.getByLabel('SKU biến thể đầu').fill(sku)
    await page.getByLabel('Giá (VND)').fill('1990000')
    await page.getByLabel('Tồn kho').fill('25')
    await page.getByLabel('Xuất bản ngay').check()
    await page.getByRole('button', { name: 'Tạo sản phẩm' }).click()

    // Server action redirects to the edit page on success; errors surface inline.
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/)
    await expect(page.getByLabel('Tên')).toHaveValue(productName)
  })

  test('product appears in the admin product list', async ({ page }) => {
    await loginAsAdmin(page, baseURL)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    await expect(page.getByText(productName)).toBeVisible()
  })

  test('product is published on the storefront', async ({ page }) => {
    await page.goto(`/products/${slug}`)
    await expect(page).toHaveURL(new RegExp(`/products/${slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(productName, 'i') })).toBeVisible()
  })

  test('restock raises on-hand in the inventory table', async ({ page }) => {
    await loginAsAdmin(page, baseURL)

    await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`)
    const row = page.getByRole('row', { name: new RegExp(sku) })
    await expect(row).toBeVisible()
    // Column order (InventoryTable): Sản phẩm, SKU, On-hand, Reserved, Available, Ngưỡng, TT, adjust.
    const onHandBefore = Number(await row.locator('td').nth(2).textContent())

    await row.getByRole('link', { name: 'Điều chỉnh' }).click()
    await expect(page).toHaveURL(/\/admin\/inventory\?.*variant=/)
    await page.getByLabel('Số lượng thay đổi').fill('5')
    await page.getByLabel('Lý do').selectOption({ label: 'Nhập thêm (restock)' })
    await page.getByRole('button', { name: 'Xác nhận điều chỉnh' }).click()

    // Panel refreshes in place; reload the filtered list and re-read on-hand.
    await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`)
    const afterRow = page.getByRole('row', { name: new RegExp(sku) })
    await expect(afterRow).toBeVisible()
    await expect(afterRow.locator('td').nth(2)).toHaveText(String(onHandBefore + 5))
  })

  test('adjustment history records the restock', async ({ page }) => {
    await loginAsAdmin(page, baseURL)
    await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`)
    const row = page.getByRole('row', { name: new RegExp(sku) })
    await expect(row).toBeVisible()
    await row.getByRole('link', { name: 'Điều chỉnh' }).click()
    await expect(page).toHaveURL(/\/admin\/inventory\?.*variant=/)

    // "Lịch sử điều chỉnh" lists changes newest-first; +5 row reflects the restock above.
    await expect(page.getByText('+5').first()).toBeVisible()
  })
})