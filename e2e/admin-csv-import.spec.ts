import { expect, test } from '@playwright/test'

import { ensureAdmin } from './admin-auth'

/**
 * CSV import: empty submit shows the inline error; pasting a valid row
 * creates/updates a product visible in the admin list.
 */
const slug = `e2e-csv-${Date.now()}`

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ts_promo_closed', 'true'))
})

test.describe.serial('admin CSV import', () => {
  test('empty submit shows the inline error', async ({ page }) => {
    await ensureAdmin(page)
    await page.goto('/admin/products/import')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Dán nội dung CSV vào ô bên dưới trước khi nhập.')).toBeVisible()
  })

  test('a valid row is imported and listed', async ({ page }) => {
    await ensureAdmin(page)
    await page.goto('/admin/products/import')
    await page.getByLabel('Dán CSV (có dòng tiêu đề)').fill(
      `slug,name,category_slug,brand_slug,description,is_published,is_featured,is_archived,variant_sku,variant_attributes,variant_regular_price,variant_sale_price,variant_stock\n` +
        `${slug},E2E CSV ${slug},dien-thoai,apple,CSV e2e row,true,false,false,E2E-CSV-${slug},"{""ram"": ""8GB""}",1000000,,5`,
    )
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText(/tạo mới 1|cập nhật 1/, { exact: false }).first()).toBeVisible({
      timeout: 15000,
    })

    await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
    await expect(page.getByText(`E2E CSV ${slug}`).first()).toBeVisible({ timeout: 10000 })
  })

  test('a bad row is rejected with reasons', async ({ page }) => {
    await ensureAdmin(page)
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
