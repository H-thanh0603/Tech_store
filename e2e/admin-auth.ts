import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@techstore.local'
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'techstore-admin-e2e'
const ADMIN_TOTP_SECRET = readFileSync('.admin-e2e-mfa-secret', 'utf8').trim()

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForURL(/\/admin\/mfa\/verify/)
  await page.getByLabel('Mã xác minh 6 chữ số').fill(totp(ADMIN_TOTP_SECRET))
  await page.getByRole('button', { name: 'Xác minh', exact: true }).click()
  await page.waitForURL(/\/admin$/)
}

/**
 * Tests run with the admin-setup storageState, so the session is usually
 * already live. Only performs the full MFA login when the session expired
 * (e.g. storage file deleted) — keeps the suite at 1 MFA verify / run.
 */
export async function ensureAdmin(page: Page) {
  await page.goto('/admin')
  if (page.url().includes('/admin/login') || page.url().includes('/mfa/')) {
    await loginAsAdmin(page)
  }
}

export function totp(secret: string): string {
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
