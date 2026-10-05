'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminPermission, type AdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { canMarkPaymentPaid, canTransitionOrderStatus } from '@/lib/admin/status-rules'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { invoiceIssueSchema, orderNoteSchema, orderPaymentSchema, orderStatusSchema } from '@/lib/admin/validation'
import type { OrderStatus, PaymentStatus } from '@/lib/commerce/types'

function fail(
  code: string,
  fieldErrors?: Record<string, string[] | undefined>,
): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

async function assertAdmin(
  permission:
    | 'orders.update'
    | 'orders.mark_paid'
    | 'orders.note'
    | 'orders.return'
    | 'orders.invoice',
): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminPermission(permission)
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

function revalidateOrders(orderCode?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/customers')
  if (orderCode) revalidatePath(`/admin/orders/${orderCode}`)
}

export async function updateOrderStatus(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin('orders.update')
  if (!('actorLabel' in admin)) return admin

  const parsed = orderStatusSchema.safeParse({
    orderCode: formData.get('orderCode'),
    orderStatus: formData.get('orderStatus'),
    reason: formData.get('reason') ?? '',
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const { data: order, error: readError } = await db
    .from('orders')
    .select('order_code, order_status, payment_status')
    .eq('order_code', parsed.data.orderCode.toUpperCase())
    .maybeSingle()

  if (readError) return fail('INTERNAL_ERROR')
  if (!order) return fail('NOT_FOUND')

  const from = order.order_status as OrderStatus
  const to = parsed.data.orderStatus
  if (!canTransitionOrderStatus(from, to)) return fail('INVALID_TRANSITION')

  const { data, error } = await db.rpc('admin_update_order', {
    p_order_code: order.order_code,
    p_order_status: to,
    p_payment_status: null,
    p_reason: parsed.data.reason || null,
    p_actor_label: admin.actorLabel,
  })

  if (error) return fail('INTERNAL_ERROR')
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return fail(code ?? 'INTERNAL_ERROR')

  revalidateOrders(order.order_code)
  return { ok: true, message: `Đã chuyển đơn sang ${to}.` }
}

export async function markOrderPaid(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin('orders.mark_paid')
  if (!('actorLabel' in admin)) return admin

  const parsed = orderPaymentSchema.safeParse({
    orderCode: formData.get('orderCode'),
    paymentStatus: 'paid',
    alsoConfirmOrder:
      formData.get('alsoConfirmOrder') === 'on' || formData.get('alsoConfirmOrder') === 'true',
  })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const db = getSupabaseAdminClient()
  const { data: order, error: readError } = await db
    .from('orders')
    .select('order_code, order_status, payment_status')
    .eq('order_code', parsed.data.orderCode.toUpperCase())
    .maybeSingle()

  if (readError) return fail('INTERNAL_ERROR')
  if (!order) return fail('NOT_FOUND')

  if (!canMarkPaymentPaid(order.payment_status as PaymentStatus)) {
    return fail('INVALID_PAYMENT')
  }

  let nextOrderStatus: OrderStatus | null = null
  if (
    parsed.data.alsoConfirmOrder &&
    canTransitionOrderStatus(order.order_status as OrderStatus, 'confirmed')
  ) {
    nextOrderStatus = 'confirmed'
  }

  const { data, error } = await db.rpc('admin_update_order', {
    p_order_code: order.order_code,
    p_order_status: nextOrderStatus,
    p_payment_status: 'paid' satisfies PaymentStatus,
    p_reason: null,
    p_actor_label: admin.actorLabel,
  })

  if (error) return fail('INTERNAL_ERROR')
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return fail(code ?? 'INTERNAL_ERROR')

  revalidateOrders(order.order_code)
  return { ok: true, message: 'Đã xác nhận thanh toán.' }
}

export async function addOrderInternalNote(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin('orders.note')
  if (!('actorLabel' in admin)) return admin

  const parsed = orderNoteSchema.safeParse({
    orderCode: formData.get('orderCode'),
    body: formData.get('body'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const { data, error } = await getSupabaseAdminClient().rpc('admin_add_order_note', {
    p_order_code: parsed.data.orderCode,
    p_body: parsed.data.body,
    p_actor_label: admin.actorLabel,
  })
  if (error) return fail('INTERNAL_ERROR')
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return fail(code ?? 'INTERNAL_ERROR')

  revalidateOrders(parsed.data.orderCode.toUpperCase())
  return { ok: true, message: 'Đã thêm ghi chú nội bộ.' }
}

export async function decideReturn(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin('orders.return')
  if (!('actorLabel' in admin)) return admin

  const returnId = String(formData.get('returnId') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const adminNote = String(formData.get('adminNote') ?? '').trim()
  const refundRaw = String(formData.get('refundAmount') ?? '').trim()
  const restockRaw = String(formData.get('restock') ?? 'true')
  const orderCode = String(formData.get('orderCode') ?? '').trim()

  if (!returnId) {
    return fail('VALIDATION_ERROR', { returnId: ['Thiếu yêu cầu trả hàng.'] })
  }
  if (!['approve', 'reject'].includes(decision)) {
    return fail('VALIDATION_ERROR', { decision: ['Quyết định không hợp lệ.'] })
  }
  let refundAmount: number | null = null
  if (decision === 'approve' && refundRaw !== '') {
    refundAmount = Number(refundRaw)
    if (!Number.isFinite(refundAmount) || refundAmount < 0) {
      return fail('VALIDATION_ERROR', { refundAmount: ['Số tiền hoàn phải >= 0.'] })
    }
  }

  // Auto-refund for VNPay orders: try the live refund BEFORE approving, so a
  // gateway rejection never leaves the order approved-but-unrefunded. Any
  // failure returns the staff to the form with the VNPay message — they can
  // still complete the manual dashboard flow.
  let refundNote: string | null = null
  if (decision === 'approve' && refundAmount !== null && refundAmount > 0) {
    const db = getSupabaseAdminClient()
    const { data: target } = await db
      .from('orders')
      .select('id, payment_method, payment_status, payment_ref, gateway_pay_date')
      .eq('order_code', orderCode.toUpperCase())
      .maybeSingle()
    if (
      target?.payment_method === 'vnpay' &&
      target?.payment_status === 'paid' &&
      target?.payment_ref
    ) {
      try {
        const { sendVnpayRefund } = await import('@/lib/commerce/vnpay-refund')
        const receipt = await sendVnpayRefund({
          orderCode: orderCode.toUpperCase(),
          transactionNo: target.payment_ref as string,
          amountVnd: refundAmount,
          payDate: (target.gateway_pay_date as string | null) ?? '',
          createdBy: admin.actorLabel,
        })
        refundNote = receipt.isMock
          ? 'Hoàn tay trên dashboard VNPay (chưa cấu hình refund live).'
          : `VNPay live OK (${receipt.requestId}).`
        await db.from('payment_refunds').insert({
          order_id: target.id,
          provider: receipt.isMock ? 'manual' : 'vnpay',
          amount: refundAmount,
          state: receipt.isMock ? 'mock_recorded' : 'succeeded',
          provider_request_id: receipt.requestId,
          provider_txn_no: receipt.isMock ? null : (target.payment_ref as string),
          created_by_label: admin.actorLabel,
        })
      } catch (refundError) {
        const message =
          refundError instanceof Error ? refundError.message : 'Hoàn tiền VNPay thất bại.'
        await getSupabaseAdminClient().from('payment_refunds').insert({
          order_id: target.id,
          provider: 'vnpay',
          amount: refundAmount,
          state: 'failed',
          error: message.slice(0, 500),
          created_by_label: admin.actorLabel,
        })
        return fail('INTERNAL_ERROR', {
          refundAmount: [`${message} Đơn chưa duyệt — hoàn tay trên dashboard rồi thử lại.`],
        })
      }
    }
  }

  const { data, error } = await getSupabaseAdminClient().rpc('admin_decide_return', {
    p_return_id: returnId,
    p_approve: decision === 'approve',
    p_admin_note: [adminNote, refundNote].filter(Boolean).join(' | ') || null,
    p_refund_amount: refundAmount,
    p_actor_label: admin.actorLabel,
    p_restock: restockRaw !== 'false',
  })
  if (error) return fail('INTERNAL_ERROR')
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return fail(code ?? 'INTERNAL_ERROR')

  if (orderCode) revalidateOrders(orderCode.toUpperCase())
  revalidatePath('/admin/orders/returns')
  revalidatePath('/admin/inventory')
  return {
    ok: true,
    message: decision === 'approve' ? 'Đã duyệt trả hàng và hoàn tồn kho.' : 'Đã từ chối yêu cầu trả hàng.',
  }
}

export async function issueInvoice(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin('orders.invoice')
  if (!('actorLabel' in admin)) return admin

  const parsed = invoiceIssueSchema.safeParse({
    orderCode: formData.get('orderCode'),
    taxCode: formData.get('taxCode') ?? '',
    companyName: formData.get('companyName') ?? '',
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const { data: order, error: readError } = await db
    .from('orders')
    .select('id, order_code')
    .eq('order_code', parsed.data.orderCode.toUpperCase())
    .maybeSingle()
  if (readError || !order) return fail('NOT_FOUND')

  const { data, error } = await db.rpc('issue_invoice', {
    p_order_id: order.id,
    p_tax_code: parsed.data.taxCode || null,
    p_company_name: parsed.data.companyName || null,
    p_actor_label: admin.actorLabel,
  })
  if (error) return fail('INTERNAL_ERROR')
  const result = data as { code?: string; invoiceNumber?: string } | null
  if (result?.code === 'ALREADY_ISSUED') {
    return { ok: true, message: `Đơn đã có hóa đơn ${result.invoiceNumber ?? ''}.` }
  }
  if (result?.code !== 'OK') return fail(result?.code ?? 'INTERNAL_ERROR')

  revalidateOrders(order.order_code)
  return { ok: true, message: `Đã xuất hóa đơn ${result.invoiceNumber}.` }
}
