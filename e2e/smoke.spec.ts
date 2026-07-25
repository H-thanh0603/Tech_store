import { expect, test } from '@playwright/test'

test.describe('storefront smoke', () => {
  test('home has main landmark and brand', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(page.getByRole('link', { name: /TechStore/i }).first()).toBeVisible()
  })

  test('products page is reachable', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByRole('main')).toBeVisible()
    // Title may vary; ensure no crash and navigation works
    await expect(page).toHaveURL(/\/products/)
  })

  test('cart page renders empty or cart state', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('track order form is accessible', async ({ page }) => {
    await page.goto('/track-order')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('robots and sitemap respond', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBeTruthy()
    const robotsBody = await robots.text()
    expect(robotsBody).toMatch(/Sitemap:/i)

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBeTruthy()
    const mapBody = await sitemap.text()
    expect(mapBody).toContain('<urlset')
  })

  test('health endpoint is ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('techstore')
  })
})

test.describe('admin security', () => {
  test('admin dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByLabel(/mật khẩu admin/i)).toBeVisible()
  })

  test('admin products also require login', async ({ page }) => {
    await page.goto('/admin/products')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('mobile shell', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('header navigation remains usable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: /điều hướng chính/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sản phẩm/i }).first()).toBeVisible()
  })
})
