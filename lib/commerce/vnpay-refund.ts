import { createHmac } from 'node:crypto'

// VNPay refund skeleton (vnp_Command=refund). Amount/security model mirrors
// lib/commerce/vnpay.ts: sort + HMAC-SHA256. Env-gated: without
// VNPAY_TMN_CODE + VNPAY_SECRET_REFUND the admin returns flow stays manual
// (dashboard merchant.vnpayment.vn) and sendVnpayRefund returns a mock
// receipt so the approval pipeline is testable end-to-end.
// Refund API docs: https://sandbox.vnpayment.vn/apis/docs/loai-hinh-giao-dich/refund/

export interface VnpayRefundConfig {
  tmnCode: string
  refundSecret: string
  apiUrl: string
}

export function getVnpayRefundConfig(): VnpayRefundConfig | null {
  const tmnCode = process.env.VNPAY_TMN_CODE
  const refundSecret = process.env.VNPAY_SECRET_REFUND ?? process.env.VNPAY_SECRET
  if (!tmnCode || !refundSecret) return null
  return {
    tmnCode,
    refundSecret,
    apiUrl: process.env.VNPAY_REFUND_URL ?? 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  }
}

export interface VnpayRefundRequest {
  orderCode: string
  /** VNPay transaction number from the original IPN (vnp_TransactionNo). */
  transactionNo: string
  amountVnd: number
  /** yyyyMMddHHmmss of the original payment. */
  payDate: string
  createdBy: string
}

export function buildVnpayRefundParams(
  request: VnpayRefundRequest,
  config: VnpayRefundConfig,
  now = new Date(),
): Record<string, string> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const params: Record<string, string> = {
    vnp_RequestId: `${request.orderCode}-${stamp}`,
    vnp_Version: '2.1.0',
    vnp_Command: 'refund',
    vnp_TmnCode: config.tmnCode,
    vnp_TransactionType: '02',
    vnp_TxnRef: request.orderCode,
    vnp_Amount: String(Math.round(request.amountVnd * 100)),
    vnp_OrderInfo: `Hoan tien don ${request.orderCode}`,
    vnp_TransactionNo: request.transactionNo,
    vnp_TransactionDate: request.payDate,
    vnp_CreateBy: request.createdBy.slice(0, 50),
    vnp_CreateDate: stamp,
    vnp_IpAddr: '127.0.0.1',
  }
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  params.vnp_SecureHash = createHmac('sha256', config.refundSecret).update(sorted).digest('hex')
  return params
}

export interface VnpayRefundReceipt {
  ok: boolean
  isMock: boolean
  requestId: string
  message: string
}

export async function sendVnpayRefund(request: VnpayRefundRequest): Promise<VnpayRefundReceipt> {
  const config = getVnpayRefundConfig()
  if (request.amountVnd <= 0) throw new Error('Số tiền hoàn phải > 0.')
  if (!request.transactionNo.trim()) throw new Error('Thiếu mã giao dịch VNPay gốc.')
  if (!config) {
    return {
      ok: true,
      isMock: true,
      requestId: `mock-${request.orderCode}`,
      message: 'Chưa cấu hình VNPAY_SECRET_REFUND — hoàn tiền tay trên dashboard rồi ghi nhận.',
    }
  }
  // Live POST is wired when the shop provides refund credentials + IPN
  // allowlist. Fail closed: never pretend a refund succeeded.
  throw new Error('Hoàn tiền VNPay live chưa đấu nối — cấu hình VNPAY_REFUND_URL + IP allowlist trước.')
}
