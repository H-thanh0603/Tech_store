'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { canMarkPaymentPaid, canTransitionOrderStatus } from '@/lib/admin/status-rules'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { orderPaymentSchema, orderStatusSchema } from '@/lib/admin/validation'
import type { OrderStatus, PaymentStatus } from '@/lib/commerce/types'

function fail(code: string): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code) }
}

async function assertAdmin(): Promise<AdminActionState | null> {
  try {
    await requireAdminSession()
    return null
  } catch {
    return fail('UNAUTHORIZED')
  }
}

function revalidateOrders(orderCode?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  if (orderCode) revalidatePath(`/admin/orders/${orderCode}`)
}

export async function updateOrderStatus(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await assertAdmin()
  if (gate) return gate

  const parsed = orderStatusSchema.safeParse({
    orderCode: formData.get('orderCode'),
    orderStatus: formData.get('orderStatus'),
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

  const from = order.order_status as OrderStatus
  const to = parsed.data.orderStatus
  if (!canTransitionOrderStatus(from, to)) return fail('INVALID_TRANSITION')

  const { data, error } = await db.rpc('admin_update_order', {
    p_order_code: order.order_code,
    p_order_status: to,
    p_payment_status: null,
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
  const gate = await assertAdmin()
  if (gate) return gate

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
  })

  if (error) return fail('INTERNAL_ERROR')
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return fail(code ?? 'INTERNAL_ERROR')

  revalidateOrders(order.order_code)
  return { ok: true, message: 'Đã xác nhận thanh toán.' }
}
