import type { OrderStatus, PaymentStatus } from '@/lib/commerce/types'

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  awaiting_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['packing', 'cancelled'],
  packing: ['shipping', 'cancelled'],
  shipping: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return false
  return ORDER_TRANSITIONS[from].includes(to)
}

export function allowedNextOrderStatuses(from: OrderStatus): OrderStatus[] {
  return [...ORDER_TRANSITIONS[from]]
}

export function canMarkPaymentPaid(status: PaymentStatus): boolean {
  return status === 'pending'
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0
}
