import { expect, test, type Page } from '@playwright/test'

/**
 * Admin login goes through the real /admin/login form against Supabase Auth.
 * Seed the account first (idempotent): `node scripts/seed-admin-user.mjs`.
 * Credentials come from env or the seed script defaults.
 */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'

// Unique per run; shared across the serial suite below.
const slug = `e2e-admin-${Date.now()}`
const productName = `E2E Admin ${slug}`
const sku = `SKU-${slug}`

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin(?!\/login)/)
}

// One serial suite: the inventory tests depend on the product the create tests
// make. Playwright runs separate `describe.serial` blocks in parallel even in
// one file (fullyParallel + multiple workers), so keep every test here —
// shipping the whole flow in order is the point of this spec.
test.describe.serial('admin CRUD: create product → storefront → adjust inventory', () => {
  test('login form reaches the admin products page', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products')
    await expect(page).toHaveURL(/\/admin\/products/)
    await expect(page.getByRole('link', { name: /\+ Sản phẩm mới/i })).toBeVisible()
  })

  test('create product form creates it and lands on the edit page', async ({ page }) => {
    await loginAsAdmin(page)
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
    await loginAsAdmin(page)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    await expect(page.getByText(productName)).toBeVisible()
  })

  test('product is published on the storefront', async ({ page }) => {
    await page.goto(`/products/${slug}`)
    await expect(page).toHaveURL(new RegExp(`/products/${slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(productName, 'i') })).toBeVisible()
  })

  test('restock raises on-hand in the inventory table', async ({ page }) => {
    await loginAsAdmin(page)

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
    await loginAsAdmin(page)
    await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`)
    const row = page.getByRole('row', { name: new RegExp(sku) })
    await expect(row).toBeVisible()
    await row.getByRole('link', { name: 'Điều chỉnh' }).click()
    await expect(page).toHaveURL(/\/admin\/inventory\?.*variant=/)

    // "Lịch sử điều chỉnh" lists changes newest-first; +5 row reflects the restock above.
    await expect(page.getByText('+5').first()).toBeVisible()
  })
})
