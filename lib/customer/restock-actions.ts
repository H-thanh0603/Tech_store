'use server'

import { z } from 'zod'

import { getSupabaseServerClient } from '@/lib/supabase/server'

export type RestockActionState = { ok: boolean; message?: string }

const restockSchema = z.object({
  variantId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  email: z.string().trim().email().max(254),
})

export async function requestRestockAlert(
  _prev: RestockActionState,
  formData: FormData,
): Promise<RestockActionState> {
  const parsed = restockSchema.safeParse({
    variantId: formData.get('variantId'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { ok: false, message: 'Email chưa hợp lệ.' }

  // Anon insert is allowed by RLS (insert-only policy); nobody can read the
  // waitlist. The active-dupe guard is a PARTIAL unique index, not an upsert
  // target — so plain insert and treat 23505 as already-registered success.
  const { error } = await getSupabaseServerClient()
    .from('product_restock_requests')
    .insert({
      variant_id: parsed.data.variantId,
      email: parsed.data.email.toLowerCase(),
      status: 'active',
    })
  if (error) {
    if (error.code === '23505') {
      return { ok: true, message: 'Email này đã đăng ký báo có hàng.' }
    }
    return { ok: false, message: 'Không đăng ký được. Thử lại sau.' }
  }
  return { ok: true, message: 'Đã đăng ký báo có hàng.' }
}
