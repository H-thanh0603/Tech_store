export interface VietQrInput {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  description: string
}

export interface VietQrTextFallback {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  description: string
}

function assertInput(input: VietQrInput): void {
  if (!/^\d{6}$/.test(input.bankId) || !/^\d{6,20}$/.test(input.accountNo)) {
    throw new Error('Invalid VietQR bank configuration')
  }
  if (!input.accountName.trim() || input.accountName.length > 100) {
    throw new Error('Invalid VietQR account name')
  }
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) {
    throw new Error('Invalid VietQR amount')
  }
  if (!/^TS-[A-Z0-9-]{1,64}$/.test(input.description)) {
    throw new Error('Invalid VietQR description')
  }
}

export function buildVietQrUrl(input: VietQrInput): string {
  assertInput(input)
  const params = new URLSearchParams({
    amount: String(input.amount),
    addInfo: input.description,
    accountName: input.accountName,
  })
  return `https://img.vietqr.io/image/${encodeURIComponent(input.bankId)}-${encodeURIComponent(input.accountNo)}-compact2.png?${params.toString()}`
}

export function getVietQrText(input: VietQrInput): VietQrTextFallback {
  assertInput(input)
  return { ...input }
}

export function getVietQrConfig(): Pick<VietQrInput, 'bankId' | 'accountNo' | 'accountName'> {
  const bankId = process.env.VIETQR_BANK_ID
  const accountNo = process.env.VIETQR_ACCOUNT_NO
  const accountName = process.env.VIETQR_ACCOUNT_NAME
  if (!bankId || !accountNo || !accountName) {
    throw new Error('VietQR configuration is missing')
  }
  return { bankId, accountNo, accountName }
}
