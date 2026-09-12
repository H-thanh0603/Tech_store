// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/admin/order-actions', () => ({
  decideReturn: vi.fn(async () => ({ ok: true, message: null })),
}))

import { ReturnsTable, type ReturnRow } from '@/components/admin/returns-table'

function returnRow(overrides: Partial<ReturnRow> = {}): ReturnRow {
  return {
    id: 'ret-1',
    orderCode: 'TS-ABC123',
    orderStatus: 'delivered',
    customerName: 'Khách A',
    requestedByPhone: '0900000000',
    reasonCode: 'changed_mind',
    customerNote: null,
    status: 'requested',
    refundAmount: null,
    adminNote: null,
    decidedAt: null,
    decidedByLabel: null,
    createdAt: '2026-09-12T00:00:00Z',
    orderTotal: '28900000',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    itemCount: 1,
    ...overrides,
  }
}

describe('ReturnsTable VNPay refund warning', () => {
  it('warns the operator to refund manually when the order paid via VNPay', async () => {
    const user = userEvent.setup()
    render(<ReturnsTable rows={[returnRow({ paymentMethod: 'vnpay' })]} />)

    await user.click(screen.getByRole('button', { name: 'Xử lý' }))

    expect(screen.getByText(/dashboard merchant\.vnpayment\.vn/i)).toBeInTheDocument()
  })

  it('shows no VNPay warning for COD orders', async () => {
    const user = userEvent.setup()
    render(<ReturnsTable rows={[returnRow({ paymentMethod: 'cod' })]} />)

    await user.click(screen.getByRole('button', { name: 'Xử lý' }))

    expect(screen.queryByText(/VNPay/i)).not.toBeInTheDocument()
  })
})
