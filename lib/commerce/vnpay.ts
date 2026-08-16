import { createHmac, timingSafeEqual } from 'node:crypto'

// VNPay payment gateway helpers. Env-gated: without VNPAY_TMN_CODE +
// VNPAY_SECRET the checkout form hides the VNPay option entirely.
// Signing follows VNPay 2.1.0: sort params alphabetically, join raw
// key=value with &, HMAC SHA-256 lowercase hex with the secret.

export interface VnpayConfig {
  tmnCode: string
  secret: string
  paymentUrl: string
}

export function getVnpayConfig(): VnpayConfig | null {
  const tmnCode = process.env.VNPAY_TMN_CODE
  const secret = process.env.VNPAY_SECRET
  if (!tmnCode || !secret) return null
  return {
    tmnCode,
    secret,
    paymentUrl:
      process.env.VNP_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  }
}

function sortedRawQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}

function sign(params: Record<string, string>, secret: string): string {
  return createHmac('sha256', secret).update(sortedRawQuery(params)).digest('hex')
}

export function verifyVnpaySignature(
  params: Record<string, string>,
  secret: string,
): boolean {
  const received = params.vnp_SecureHash
  if (!received) return false
  const rest: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') continue
    rest[key] = value
  }
  const expected = sign(rest, secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

function vnpayCreateDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

export function buildVnpayUrl(options: {
  orderCode: string
  amountVnd: number
  ipAddr: string
  returnUrl: string
}): string | null {
  const config = getVnpayConfig()
  if (!config) return null

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    // VNPay requires the amount in the smallest currency unit (VND × 100).
    vnp_Amount: String(Math.round(options.amountVnd * 100)),
    vnp_CreateDate: vnpayCreateDate(new Date()),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: options.ipAddr || '127.0.0.1',
    vnp_Locale: 'vn',
    vnp_OrderInfo: `Thanh toan don hang ${options.orderCode}`,
    vnp_OrderType: 'other',
    vnp_ReturnUrl: options.returnUrl,
    vnp_TxnRef: options.orderCode,
  }
  params.vnp_SecureHash = sign(params, config.secret)

  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${config.paymentUrl}?${query}`
}
