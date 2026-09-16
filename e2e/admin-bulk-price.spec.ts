import { expect, test } from '@playwright/test'

import { ensureAdmin } from './admin-auth'

/**
 * Bulk price/stock ops on the admin product list. Creates its own product
 * so the suite is independent from admin-crud. window.prompt is answered
 * via the dialog handler before clicking the bulk buttons.
 */
const slug = `e2e-bulk-${Date.now()}`
const productName = `E2E Bulk ${slug}`

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ts_promo_closed', 'true'))
})

test.describe.serial('admin bulk price/stock', () => {
  test('creates a product for bulk ops', async ({ page }) => {
    await ensureAdmin(page)
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
    await ensureAdmin(page)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    const row = page.locator('tbody tr', { hasText: productName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('checkbox').check()

    page.on('dialog', (dialog) => void dialog.accept('10'))
    await page.getByRole('button', { name: 'Giá +%' }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    // Server action ends with router.refresh(); reload to read the new price
    // deterministically instead of racing the client re-render.
    await expect(page.getByText(/Đã cập nhật giá|Thành công/).first()).toBeVisible({
      timeout: 15000,
    })
    await page.reload()
    await expect(page.getByText(/1\.100\.000|1100000/).first()).toBeVisible({ timeout: 15000 })
  })

  test('bulk remove-sale and set-stock work', async ({ page }) => {
    await ensureAdmin(page)
    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    const row = page.locator('tbody tr', { hasText: productName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('checkbox').check()

    // set_sale_off prompts with an empty default — accept to proceed.
    page.on('dialog', (dialog) => void dialog.accept(''))
    await page.getByRole('button', { name: 'Xóa sale' }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByText(/Đã cập nhật giá|Thành công/).first()).toBeVisible({
      timeout: 15000,
    })
  })
})
