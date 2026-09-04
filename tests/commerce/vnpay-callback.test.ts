import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn(async () => ({ data: { code: 'OK' }, error: null }))
const auditInsert = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ rpc, from: () => ({ insert: auditInsert }) }),
}))

vi.mock('@/lib/commerce/vnpay', () => ({
  getVnpayConfig: () => ({ tmnCode: 'test', secret: 'test-secret', paymentUrl: 'https://pay.test' }),
  verifyVnpaySignature: () => true,
}))

import { handleVnpayCallback } from '@/lib/commerce/vnpay-callback'

const successfulParams = {
  vnp_TxnRef: 'TS-20260824-000001',
  vnp_ResponseCode: '00',
  vnp_TransactionStatus: '00',
  vnp_TransactionNo: 'VNP-000001',
  vnp_Amount: '100000',
}

describe('handleVnpayCallback', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { code: 'OK' }, error: null })
    auditInsert.mockReset().mockResolvedValue({ error: null })
  })

  it('rejects a signed callback whose transaction status is not successful', async () => {
    const result = await handleVnpayCallback({
      ...successfulParams,
      vnp_TransactionStatus: '02',
    })

    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not report success when the database says the order expired', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'ORDER_EXPIRED' }, error: null })

    const result = await handleVnpayCallback(successfulParams)

    expect(result.ok).toBe(false)
    expect(result.message).toBe('Đơn hàng đã hết thời gian thanh toán.')
    expect(result.ipnResponseCode).toBe('02')
  })

  it('accepts a reopened late payment and stops gateway retries', async () => {
    rpc.mockResolvedValueOnce({
      data: { code: 'REOPENED', reopenedFromExpired: true },
      error: null,
    })

    const result = await handleVnpayCallback(successfulParams)

    expect(result.ok).toBe(true)
    expect(result.message).toBe('Đã nhận thanh toán muộn, đơn hàng đang được xử lý lại.')
    expect(result.ipnResponseCode).toBe('00')
    expect(auditInsert).toHaveBeenCalledOnce()
  })

  it('accepts an exact replay that the database already settled', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'ALREADY_PAID' }, error: null })

    const result = await handleVnpayCallback(successfulParams)

    expect(result.ok).toBe(true)
    expect(result.ipnResponseCode).toBe('00')
  })
})
