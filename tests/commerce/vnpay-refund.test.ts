import { describe, expect, it } from 'vitest'

import {
  buildVnpayRefundParams,
  sendVnpayRefund,
} from '@/lib/commerce/vnpay-refund'

const config = { tmnCode: 'TEST', refundSecret: 'secret', apiUrl: 'https://example.invalid' }

describe('vnpay refund params', () => {
  it('signs sorted params with a hex HMAC', () => {
    const params = buildVnpayRefundParams(
      {
        orderCode: 'TS-20260912-000001',
        transactionNo: '123456',
        amountVnd: 150000,
        payDate: '20260912093000',
        createdBy: 'admin@shop',
      },
      config,
      new Date('2026-09-12T10:00:00Z'),
    )
    expect(params.vnp_Command).toBe('refund')
    expect(params.vnp_Amount).toBe(String(150000 * 100))
    expect(params.vnp_SecureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a mock receipt without refund credentials', async () => {
    const receipt = await sendVnpayRefund({
      orderCode: 'TS-20260912-000001',
      transactionNo: '123456',
      amountVnd: 150000,
      payDate: '20260912093000',
      createdBy: 'admin@shop',
    })
    expect(receipt.isMock).toBe(true)
    expect(receipt.ok).toBe(true)
    await expect(
      sendVnpayRefund({
        orderCode: 'TS-1',
        transactionNo: ' ',
        amountVnd: 100,
        payDate: '20260912093000',
        createdBy: 'admin',
      }),
    ).rejects.toThrow()
  })
})
