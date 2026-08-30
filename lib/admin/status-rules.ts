import type { OrderStatus, PaymentStatus } from '@/lib/commerce/types'

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  awaiting_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['packing', 'cancelled'],
  packing: ['shipping', 'cancelled'],
  shipping: ['completed', 'return_requested'],
  completed: ['return_requested'],
  return_requested: ['returned'],
  // Returns are decided through admin_decide_return, which either
  // restocks (returned) or restores the previous state server-side.
  returned: [],
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
