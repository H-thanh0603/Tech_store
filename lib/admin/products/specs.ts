'use server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { specDeleteSchema, specUpsertSchema, useCasesSchema } from '@/lib/admin/validation'

import { assertAdmin, fail, revalidateCatalog, writeAudit } from './shared'

export async function upsertSpec(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = specUpsertSchema.safeParse({
    specId: formData.get('specId') ?? '',
    groupName: formData.get('groupName'),
    label: formData.get('label'),
    value: formData.get('value'),
    sortOrder: formData.get('sortOrder') ?? 0,
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const payload = {
    product_id: productId,
    group_name: parsed.data.groupName,
    label: parsed.data.label,
    value: parsed.data.value,
    sort_order: parsed.data.sortOrder,
  }

  if (parsed.data.specId) {
    const { error } = await db.from('product_specs').update(payload).eq('id', parsed.data.specId)
    if (error) return fail('INTERNAL_ERROR')
  } else {
    const { error } = await db.from('product_specs').insert(payload)
    if (error) return fail('INTERNAL_ERROR')
  }

  await writeAudit(
    parsed.data.specId ? 'spec_update' : 'spec_create',
    productId,
    { group_name: parsed.data.groupName, label: parsed.data.label, value: parsed.data.value },
    admin,
  )
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu thông số.' }
}

export async function deleteSpec(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = specDeleteSchema.safeParse({ specId: formData.get('specId') })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const { error } = await getSupabaseAdminClient()
    .from('product_specs')
    .delete()
    .eq('id', parsed.data.specId)
    .eq('product_id', productId)
  if (error) return fail('INTERNAL_ERROR')

  await writeAudit('spec_delete', productId, { spec_id: parsed.data.specId }, admin)
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã xóa thông số.' }
}

export async function replaceUseCases(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = useCasesSchema.safeParse({ useCases: formData.get('useCases') ?? '' })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const tags = parsed.data.useCases
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20)

  const db = getSupabaseAdminClient()
  const { error: delError } = await db.from('product_use_cases').delete().eq('product_id', productId)
  if (delError) return fail('INTERNAL_ERROR')

  if (tags.length > 0) {
    const { error } = await db.from('product_use_cases').insert(
      tags.map((use_case) => ({ product_id: productId, use_case })),
    )
    if (error) return fail('INTERNAL_ERROR')
  }

  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu use cases.' }
}
