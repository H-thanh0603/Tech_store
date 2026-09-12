// Internal invoice (hóa đơn nội bộ) — records what the shop owes the
// customer for tax/accounting before a certified e-invoice provider
// (Viettel/MISA/VNPT) is contracted. Pure helpers: numbering, totals,
// MST validation. Persistence lives in the invoices table.

export interface InvoiceInput {
  orderCode: string
  orderTotal: number
  customerName: string
  /** 10-digit tax code, optional for retail customers. */
  taxCode?: string | null
  companyName?: string | null
  companyAddress?: string | null
}

export interface InvoiceDraft {
  invoiceNumber: string
  orderCode: string
  total: number
  vatRate: number
  vatAmount: number
  customerName: string
  taxCode: string | null
  companyName: string | null
}

export const INTERNAL_VAT_RATE = 0.1

export function isValidTaxCode(value: string | null | undefined): boolean {
  if (value == null || value === '') return true
  return /^\d{10}(-\d{3})?$/.test(value.trim())
}

export function buildInvoiceNumber(date = new Date(), sequence: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  return `INV-${day}-${String(sequence).padStart(6, '0')}`
}

export function buildInvoiceDraft(input: InvoiceInput, sequence: number, date = new Date()): InvoiceDraft {
  if (!input.orderCode.trim()) throw new Error('Thiếu mã đơn hàng.')
  if (!Number.isFinite(input.orderTotal) || input.orderTotal <= 0) {
    throw new Error('Tổng đơn không hợp lệ.')
  }
  if (!isValidTaxCode(input.taxCode)) throw new Error('Mã số thuế phải 10 chữ số.')
  const total = Math.round(input.orderTotal)
  const vatAmount = Math.round((total * INTERNAL_VAT_RATE) / (1 + INTERNAL_VAT_RATE))
  return {
    invoiceNumber: buildInvoiceNumber(date, sequence),
    orderCode: input.orderCode.trim(),
    total,
    vatRate: INTERNAL_VAT_RATE,
    vatAmount,
    customerName: input.customerName.trim(),
    taxCode: input.taxCode?.trim() || null,
    companyName: input.companyName?.trim() || null,
  }
}
