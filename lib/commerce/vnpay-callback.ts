import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getVnpayConfig, verifyVnpaySignature } from '@/lib/commerce/vnpay'

// Shared VNPay callback handling for the browser return route and the
// server-to-server IPN route. Signature verification is mandatory before any
// state change; the RPC itself is idempotent (ALREADY_PAID guard).

export interface VnpayCallbackResult {
  ok: boolean
  orderCode: string | null
  message: string
  ipnResponseCode: '00' | '01' | '02' | '04' | '97' | '99'
}

export async function handleVnpayCallback(
  searchParams: Record<string, string>,
): Promise<VnpayCallbackResult> {
  const config = getVnpayConfig()
  if (!config) {
    return { ok: false, orderCode: null, message: 'VNPay chưa được cấu hình.', ipnResponseCode: '99' }
  }
  if (!verifyVnpaySignature(searchParams, config.secret)) {
    return { ok: false, orderCode: null, message: 'Chữ ký không hợp lệ.', ipnResponseCode: '97' }
  }

  const orderCode = searchParams.vnp_TxnRef ?? null
  if (!orderCode) {
    return { ok: false, orderCode: null, message: 'Thiếu mã đơn hàng.', ipnResponseCode: '01' }
  }
  // Both the gateway response and the transaction itself must be successful.
  if (
    searchParams.vnp_ResponseCode !== '00' ||
    searchParams.vnp_TransactionStatus !== '00'
  ) {
    return {
      ok: false,
      orderCode,
      message: 'Giao dịch không thành công hoặc đã bị hủy.',
      ipnResponseCode: '00',
    }
  }

  const amount = Number(searchParams.vnp_Amount ?? 0)
  const { data, error } = await getSupabaseAdminClient().rpc('order_mark_paid_by_gateway', {
    p_order_code: orderCode,
    p_vnp_transaction_no: searchParams.vnp_TransactionNo ?? '',
    p_vnp_amount: Number.isFinite(amount) ? amount : 0,
  })
  if (error) {
    console.error('[vnpay] payment confirmation RPC failed', error.code)
    return { ok: false, orderCode, message: 'Không xác nhận được thanh toán.', ipnResponseCode: '99' }
  }
  const result = data as { code?: string } | null
  if (result?.code === 'OK' || result?.code === 'ALREADY_PAID') {
    return { ok: true, orderCode, message: 'Thanh toán thành công.', ipnResponseCode: '00' }
  }
  if (result?.code === 'AMOUNT_MISMATCH') {
    return { ok: false, orderCode, message: 'Số tiền thanh toán không khớp đơn hàng.', ipnResponseCode: '04' }
  }
  if (result?.code === 'ORDER_EXPIRED') {
    // Valid VNPay payment arrived after 24h expiry — money deducted but order
    // is expired. Requires manual refund or reopen (API-001). Record for ops.
    try {
      await getSupabaseAdminClient().from('admin_audit_logs').insert({
        action: 'vnpay_expired_paid',
        entity_type: 'order',
        entity_id: orderCode,
        payload: {
          vnpTransactionNo: searchParams.vnp_TransactionNo ?? '',
          vnpAmount: amount,
          reason: 'paid_after_expiry_requires_refund',
        },
        actor_label: 'vnpay-ipn',
      })
    } catch {
      // audit insert failure must not mask the IPN response
    }
    return { ok: false, orderCode, message: 'Đơn hàng đã hết thời gian thanh toán.', ipnResponseCode: '02' }
  }
  if (result?.code === 'ORDER_NOT_PAYABLE' || result?.code === 'PAYMENT_CONFLICT') {
    return { ok: false, orderCode, message: 'Đơn hàng không thể nhận thanh toán này.', ipnResponseCode: '02' }
  }
  if (result?.code === 'NOT_FOUND') {
    return { ok: false, orderCode, message: 'Không tìm thấy đơn hàng.', ipnResponseCode: '01' }
  }
  return { ok: false, orderCode, message: 'Không xác nhận được thanh toán.', ipnResponseCode: '99' }
}
