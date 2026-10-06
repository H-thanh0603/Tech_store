import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/commerce/types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xử lý',
  awaiting_payment: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
  return_requested: 'Yêu cầu trả hàng',
  returned: 'Đã trả hàng',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'COD',
  bank_transfer: 'Chuyển khoản',
  vnpay: 'VNPay',
  bank_card: 'Thẻ / QR',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  installment: 'Trả góp',
}

export function orderStatusLabel(status: string): string {
  return (ORDER_STATUS_LABEL as Record<string, string>)[status] ?? status
}

export function paymentStatusLabel(status: string): string {
  return (PAYMENT_STATUS_LABEL as Record<string, string>)[status] ?? status
}

export function paymentMethodLabel(method: string): string {
  return (PAYMENT_METHOD_LABEL as Record<string, string>)[method] ?? method
}
