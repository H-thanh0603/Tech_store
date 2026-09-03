import { revalidatePath } from 'next/cache'

import { requireAdminSession, type AdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'

export function fail(
  code: string,
  fieldErrors?: Record<string, string[] | undefined>,
): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

export function revalidateCatalog(productId?: string, slug?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath('/products')
  revalidatePath('/', 'layout')
  if (productId) revalidatePath(`/admin/products/${productId}`)
  if (slug) revalidatePath(`/products/${slug}`)
}

export async function assertAdmin(): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminSession('products')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

export async function writeAudit(
  action: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actor: AdminSession,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: 'product',
      entity_id: entityId,
      payload,
      actor_label: actor.actorLabel,
      actor_user_id: actor.userId,
    })
  } catch {
    // Audit table may not exist until migration applied; don't fail business action.
  }
}

export function salePriceValue(raw: number | '' | undefined): number | null {
  if (raw === '' || raw === undefined) return null
  return Number(raw)
}
