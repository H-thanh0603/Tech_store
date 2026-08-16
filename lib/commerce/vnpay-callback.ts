import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getVnpayConfig, verifyVnpaySignature } from '@/lib/commerce/vnpay'

// Shared VNPay callback handling for the browser return route and the
// server-to-server IPN route. Signature verification is mandatory before any
// state change; the RPC itself is idempotent (ALREADY_PAID guard).

export interface VnpayCallbackResult {
  ok: boolean
  orderCode: string | null
  message: string
}

export async function handleVnpayCallback(
  searchParams: Record<string, string>,
): Promise<VnpayCallbackResult> {
  const config = getVnpayConfig()
  if (!config) {
    return { ok: false, orderCode: null, message: 'VNPay chưa được cấu hình.' }
  }
  if (!verifyVnpaySignature(searchParams, config.secret)) {
    return { ok: false, orderCode: null, message: 'Chữ ký không hợp lệ.' }
  }

  const orderCode = searchParams.vnp_TxnRef ?? null
  if (!orderCode) {
    return { ok: false, orderCode: null, message: 'Thiếu mã đơn hàng.' }
  }
  // VNPay signals success with vnp_ResponseCode = '00'.
  if (searchParams.vnp_ResponseCode !== '00') {
    return {
      ok: false,
      orderCode,
      message: 'Giao dịch không thành công hoặc đã bị hủy.',
    }
  }

  const amount = Number(searchParams.vnp_Amount ?? 0)
  const { data } = await getSupabaseAdminClient().rpc('order_mark_paid_by_gateway', {
    p_order_code: orderCode,
    p_vnp_transaction_no: searchParams.vnp_TransactionNo ?? '',
    p_vnp_amount: Number.isFinite(amount) ? amount : 0,
  })
  const result = data as { code?: string } | null
  if (result?.code === 'OK' || result?.code === 'ALREADY_PAID') {
    return { ok: true, orderCode, message: 'Thanh toán thành công.' }
  }
  if (result?.code === 'AMOUNT_MISMATCH') {
    return { ok: false, orderCode, message: 'Số tiền thanh toán không khớp đơn hàng.' }
  }
  return { ok: false, orderCode, message: 'Không xác nhận được thanh toán.' }
}
