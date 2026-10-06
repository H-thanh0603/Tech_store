import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { totp } from '../e2e/admin-auth.ts'

const email = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const password = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'
const secret = readFileSync('.admin-e2e-mfa-secret', 'utf8').trim()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:3000/admin/login')
await page.getByLabel('Email').fill(email)
await page.getByLabel('Mật khẩu').fill(password)
await page.getByRole('button', { name: 'Đăng nhập' }).click()
await page.waitForURL(/\/admin\/mfa\/verify/)
await page.getByLabel('Mã xác minh 6 chữ số').fill(totp(secret))
await page.getByRole('button', { name: 'Xác minh', exact: true }).click()
await page.waitForURL(/\/admin$/)
console.log('LOGGED IN:', page.url())

await page.screenshot({ path: 'admin-dashboard.png', fullPage: false })
await ctx.storageState({ path: 'admin-storage-state.json' })
console.log('saved: admin-dashboard.png, admin-storage-state.json')
await browser.close()
