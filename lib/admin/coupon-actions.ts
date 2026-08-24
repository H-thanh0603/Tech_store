'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminSession, type AdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { couponUpsertSchema } from '@/lib/admin/validation'

function fail(
  code: string,
  fieldErrors?: Record<string, string[] | undefined>,
): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

async function assertAdmin(): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminSession('coupons')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

function revalidateCoupons() {
  revalidatePath('/admin/coupons')
  revalidatePath('/cart')
  revalidatePath('/checkout')
}

async function writeAudit(
  action: string,
  entityId: string,
  payload: Record<string, unknown>,
  actor: AdminSession,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: 'coupon',
      entity_id: entityId,
      payload,
      actor_label: actor.actorLabel,
      actor_user_id: actor.userId,
    })
  } catch {
    // Audit table may not exist until migration applied; don't fail business action.
  }
}

export async function upsertCoupon(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = couponUpsertSchema.safeParse({
    id: formData.get('id') ?? '',
    code: formData.get('code'),
    discountType: formData.get('discountType'),
    discountValue: formData.get('discountValue'),
    minimumOrder: formData.get('minimumOrder') ?? 0,
    maximumDiscount: formData.get('maximumDiscount') ?? '',
    startsAt: formData.get('startsAt') ?? '',
    endsAt: formData.get('endsAt') ?? '',
    usageLimit: formData.get('usageLimit') ?? '',
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const maxDiscount =
    parsed.data.maximumDiscount === '' || parsed.data.maximumDiscount === undefined
      ? null
      : Number(parsed.data.maximumDiscount)
  const usageLimit =
    parsed.data.usageLimit === '' || parsed.data.usageLimit === undefined
      ? null
      : Number(parsed.data.usageLimit)
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null

  const payload = {
    code: parsed.data.code,
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    minimum_order: parsed.data.minimumOrder,
    maximum_discount: maxDiscount,
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: usageLimit,
    is_active: parsed.data.isActive ?? true,
  }

  const db = getSupabaseAdminClient()
  if (parsed.data.id) {
    const { error } = await db.from('coupons').update(payload).eq('id', parsed.data.id)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
    await writeAudit('coupon_update', parsed.data.code, payload, admin)
  } else {
    const { error } = await db.from('coupons').insert(payload)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
    await writeAudit('coupon_create', parsed.data.code, payload, admin)
  }

  revalidateCoupons()
  return { ok: true, message: 'Đã lưu coupon.' }
}

export async function setCouponActive(
  couponId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const { data, error } = await getSupabaseAdminClient()
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId)
    .select('code')
    .maybeSingle()
  if (error) return fail('INTERNAL_ERROR')

  await writeAudit(
    isActive ? 'coupon_activate' : 'coupon_deactivate',
    data?.code ?? couponId,
    { isActive },
    admin,
  )
  revalidateCoupons()
  return {
    ok: true,
    message: isActive ? 'Đã bật coupon.' : 'Đã tắt coupon.',
  }
}
