'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminSession, type AdminSession } from '@/lib/admin/auth'
import {
  bannerUpsertSchema,
  flashOfferUpsertSchema,
  navigationUpsertSchema,
  parseSectionForm,
} from '@/lib/admin/content-validation'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'

function fail(code: string, fieldErrors?: Record<string, string[] | undefined>): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

async function gate(): Promise<AdminActionState | null> {
  try { await requireAdminSession('content'); return null } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

function refreshContent() {
  revalidatePath('/admin/content')
  revalidatePath('/', 'layout')
}

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

export async function upsertBanner(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const denied = await gate(); if (denied) return denied
  const raw = formValues(formData)
  const parsed = bannerUpsertSchema.safeParse({ ...raw, isActive: raw.isActive === 'true' })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  const value = parsed.data
  const payload = {
    name: value.name, slot: value.slot, title: value.title ?? null, subtitle: value.subtitle ?? null,
    image_desktop_url: value.imageDesktopUrl ?? null, image_mobile_url: value.imageMobileUrl ?? null,
    href: value.href, sort_order: value.sortOrder, is_active: value.isActive,
  }
  const query = value.id
    ? getSupabaseAdminClient().from('banners').update(payload).eq('id', value.id)
    : getSupabaseAdminClient().from('banners').insert(payload)
  const { error } = await query
  if (error) return fail('INTERNAL_ERROR')
  refreshContent(); return { ok: true, message: 'Đã lưu banner.' }
}

export async function upsertHomepageSection(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const denied = await gate(); if (denied) return denied
  const raw = formValues(formData)
  const parsed = parseSectionForm({ ...raw, isActive: raw.isActive === 'true' })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  const value = parsed.data
  const payload = {
    section_key: value.sectionKey, section_type: value.sectionType, title: value.title ?? null,
    subtitle: value.subtitle ?? null, eyebrow: value.eyebrow ?? null, config: value.config,
    sort_order: value.sortOrder, is_active: value.isActive,
  }
  const query = value.id
    ? getSupabaseAdminClient().from('homepage_sections').update(payload).eq('id', value.id)
    : getSupabaseAdminClient().from('homepage_sections').insert(payload)
  const { error } = await query
  if (error) return fail(error.code === '23505' ? 'SLUG_TAKEN' : 'INTERNAL_ERROR')
  refreshContent(); return { ok: true, message: 'Đã lưu section.' }
}

export async function upsertNavigationItem(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const denied = await gate(); if (denied) return denied
  const raw = formValues(formData)
  const parsed = navigationUpsertSchema.safeParse({
    ...raw, isActive: raw.isActive === 'true', openInNewTab: raw.openInNewTab === 'true',
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  const value = parsed.data
  const payload = {
    parent_id: value.parentId || null, label: value.label, href: value.href || null,
    item_type: value.itemType, icon_key: value.iconKey || null, image_url: value.imageUrl ?? null,
    sort_order: value.sortOrder, is_active: value.isActive, open_in_new_tab: value.openInNewTab,
  }
  const query = value.id
    ? getSupabaseAdminClient().from('navigation_items').update(payload).eq('id', value.id)
    : getSupabaseAdminClient().from('navigation_items').insert(payload)
  const { error } = await query
  if (error) return fail('INTERNAL_ERROR')
  refreshContent(); return { ok: true, message: 'Đã lưu menu.' }
}

async function writeAudit(
  action: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof requireAdminSession>>,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: 'flash_offer',
      entity_id: entityId,
      payload,
      actor_label: actor.actorLabel,
      actor_user_id: actor.userId,
    })
  } catch {
    // Audit insert must never block the business action (pattern: product-actions).
  }
}

export async function upsertFlashOffer(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('content')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
  const raw = formValues(formData)
  const parsed = flashOfferUpsertSchema.safeParse({ ...raw, isActive: raw.isActive === 'true' })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  const value = parsed.data
  const payload = {
    product_id: value.productId, title: value.title, badge: value.badge,
    starts_at: value.startsAt ? new Date(value.startsAt).toISOString() : null,
    ends_at: new Date(value.endsAt).toISOString(),
    sort_order: value.sortOrder, is_active: value.isActive,
  }
  const query = value.id
    ? getSupabaseAdminClient().from('flash_offers').update(payload).eq('id', value.id)
    : getSupabaseAdminClient().from('flash_offers').insert(payload)
  const { data, error } = await query.select('id').single()
  if (error) return fail('INTERNAL_ERROR')
  await writeAudit(value.id ? 'flash_offer_update' : 'flash_offer_create', data?.id ?? null, payload, actor)
  refreshContent(); return { ok: true, message: 'Đã lưu flash offer.' }
}

export async function deleteContentItem(
  kind: 'banner' | 'section' | 'navigation' | 'flash',
  id: string,
): Promise<AdminActionState> {
  let actor: AdminSession | null = null
  try {
    actor = await requireAdminSession('content')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
  const table = kind === 'banner'
    ? 'banners'
    : kind === 'section'
      ? 'homepage_sections'
      : kind === 'flash'
        ? 'flash_offers'
        : 'navigation_items'
  const { error } = await getSupabaseAdminClient().from(table).delete().eq('id', id)
  if (error) return fail('INTERNAL_ERROR')
  if (kind === 'flash') await writeAudit('flash_offer_delete', id, {}, actor)
  refreshContent(); return { ok: true, message: 'Đã xóa nội dung.' }
}
