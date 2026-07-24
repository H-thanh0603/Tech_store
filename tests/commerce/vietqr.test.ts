import { describe, expect, it } from 'vitest'

import { buildVietQrUrl, getVietQrText } from '@/lib/commerce/vietqr'

describe('buildVietQrUrl', () => {
  it('encodes amount and order description without customer PII', () => {
    const url = buildVietQrUrl({
      bankId: '970422',
      accountNo: '123456789',
      accountName: 'TECHSTORE',
      amount: 30990000,
      description: 'TS-20260724-0001',
    })
    expect(url).toContain('amount=30990000')
    expect(url).toContain('addInfo=TS-20260724-0001')
    expect(url).not.toContain('Nguyen')
    expect(url).not.toContain('090')
  })

  it('rejects invalid integer VND amounts and unsafe descriptions', () => {
    expect(() =>
      buildVietQrUrl({
        bankId: '970422',
        accountNo: '123456789',
        accountName: 'TECHSTORE',
        amount: 10.5,
        description: 'TS-1',
      }),
    ).toThrow()
    expect(() =>
      buildVietQrUrl({
        bankId: '970422',
        accountNo: '123456789',
        accountName: 'TECHSTORE',
        amount: 1000,
        description: 'Nguyen 0901234567',
      }),
    ).toThrow()
  })
})

describe('getVietQrText', () => {
  it('returns accessible bank transfer fallback details', () => {
    expect(
      getVietQrText({
        bankId: '970422',
        accountNo: '123456789',
        accountName: 'TECHSTORE',
        amount: 1000,
        description: 'TS-1',
      }),
    ).toEqual({
      bankId: '970422',
      accountNo: '123456789',
      accountName: 'TECHSTORE',
      amount: 1000,
      description: 'TS-1',
    })
  })
})
