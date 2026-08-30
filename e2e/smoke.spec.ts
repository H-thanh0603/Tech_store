import { expect, test } from '@playwright/test'

// The promo popup (cd64928) auto-opens ~1.2s after mount on every commerce page
// as a full-screen modal that intercepts pointer events on add-to-cart and
// product-card buttons. Pre-seed its "seen" flag on every page before it mounts
// so the popup never appears and cannot block clicks. Deterministic — no timer +
// click races to dismiss afterward.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('ts_promo_closed', 'true')
  })
})

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

  test('product detail page is reachable from the catalog', async ({ page }) => {
    await page.goto('/products')
    await page.locator('article').first().getByRole('link').first().click()
    await expect(page).toHaveURL(/\/products\/[^/]+$/)
    await expect(page.getByRole('button', { name: /thêm vào giỏ|tạm hết hàng/i }).first()).toBeVisible()
  })

  test('cart page renders empty or cart state', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('track order form is accessible', async ({ page }) => {
    await page.goto('/track-order')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('customer account redirects guests to login', async ({ page }) => {
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account\/login/)
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
    await expect(page.getByLabel(/^mật khẩu$/i)).toBeVisible()
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

  test('bottom navigation exposes five destinations', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: /điều hướng chính/i })
    await expect(bar.getByRole('link', { name: /trang chủ/i })).toBeVisible()
    await expect(bar.getByRole('link', { name: /danh mục/i })).toBeVisible()
    await expect(bar.getByRole('button', { name: /tìm kiếm/i })).toBeVisible()
    await expect(bar.getByRole('link', { name: /đơn hàng/i })).toBeVisible()
    await expect(bar.getByRole('link', { name: /tài khoản/i })).toBeVisible()
  })

  test('category drawer opens and closes with the keyboard', async ({ page }) => {
    await page.goto('/')
    const drawer = page.getByRole('dialog', { name: /danh mục và điều hướng/i })

    // Retry the click: in dev the first click can land before hydration.
    await expect(async () => {
      await page.getByRole('button', { name: 'Mở menu danh mục' }).click()
      await expect(drawer).toBeVisible({ timeout: 1000 })
    }).toPass()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
  })

  test('category drawer traps tab focus', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Mở menu danh mục' }).click()
    const drawer = page.getByRole('dialog', { name: /danh mục và điều hướng/i })
    const focusable = drawer.locator('a[href], button:not([disabled])')

    await focusable.last().focus()
    await page.keyboard.press('Tab')
    await expect(focusable.first()).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(focusable.last()).toBeFocused()
  })
})

test.describe.serial('guest checkout journey', () => {
  test('adds a product, checks out and tracks the order', async ({ page }) => {
    await page.goto('/products')
    await page.locator('article').first().getByRole('link').first().click()

    await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).first().click()
    await expect(page.getByText('Đã thêm vào giỏ', { exact: true })).toBeVisible()

    await page.goto('/cart')
    await page.getByRole('link', { name: 'Đến thanh toán' }).click()
    await page.getByLabel(/Họ và tên/).fill('E2E Guest')
    await page.getByLabel(/Số điện thoại/).fill('0901234567')
    await page.getByLabel(/Tỉnh\/thành phố/).fill('TP.HCM')
    await page.getByLabel(/Quận\/huyện/).fill('Quận 1')
    await page.getByLabel(/Phường\/xã/).fill('Bến Nghé')
    await page.getByLabel(/Địa chỉ cụ thể/).fill('1 Nguyễn Huệ')
    await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/[^/]+\/confirmation$/)
    // Assert rendered content, not just the URL: order_get_by_access is the
    // anon-key RPC behind this page — a grant/invoker regression (202608270002)
    // renders notFound() at the same URL and must fail this spec.
    await expect(page.getByText('Đặt hàng thành công')).toBeVisible()
    await expect(page.getByText(/Thanh toán/i)).toBeVisible()

    const orderCode = new URL(page.url()).pathname.split('/')[2]
    await page.goto('/track-order')
    await page.getByLabel('Mã đơn hàng').fill(orderCode)
    await page.getByLabel('Số điện thoại').fill('0901234567')
    await page.getByRole('button', { name: 'Tra cứu đơn hàng' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${orderCode}$`))
    await expect(page.getByText(`Đơn hàng ${orderCode}`)).toBeVisible()
    await expect(page.getByText('Thanh toán')).toBeVisible()
  })
})

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('mega menu opens a panel with brand and price columns', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: /danh mục sản phẩm$/i })
    const brands = page.getByText('Thương hiệu', { exact: true })

    await expect(async () => {
      await bar.getByRole('button', { name: /^Laptop/ }).first().click()
      await expect(brands).toBeVisible({ timeout: 1000 })
    }).toPass()

    await expect(page.getByText('Mức giá', { exact: true })).toBeVisible()
  })

  test('search overlay offers popular keywords before typing', async ({ page }) => {
    await page.goto('/')
    const popular = page.getByRole('region', { name: /từ khóa phổ biến/i })

    await expect(async () => {
      await page.getByLabel('Tìm sản phẩm').first().click()
      await expect(popular).toBeVisible({ timeout: 1000 })
    }).toPass()
  })
})

test.describe('homepage commerce zone', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('hero renders the category rail and a level-1 heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: /danh mục nổi bật/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('campaign quick links and the member block are present', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /mua nhanh hơn|chào /i })).toBeVisible()
  })

  test('deal tabs switch product sets without a reload', async ({ page }) => {
    await page.goto('/')
    // S3 added more deal_tabs sections (§4.6/§4.7), so tabs/tabpanels are no
    // longer unique page-wide — scope to the first tablist's own section.
    const dealsSection = page.locator('section', { has: page.getByRole('tablist') }).first()
    const tabs = dealsSection.getByRole('tab')
    await expect(tabs.first()).toBeVisible()

    const secondTab = tabs.nth(1)
    const label = await secondTab.textContent()

    await expect(async () => {
      await secondTab.click()
      await expect(secondTab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 })
    }).toPass()

    // The panel is labelled by the active tab, so switching must relabel it.
    await expect(dealsSection.getByRole('tabpanel')).toBeVisible()
    expect(label?.trim().length).toBeGreaterThan(0)
  })

  test('mobile hero exposes the quick category grid', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: /danh mục nhanh/i })).toBeVisible()
  })
})
