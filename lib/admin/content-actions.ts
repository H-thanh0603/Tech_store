'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminSession } from '@/lib/admin/auth'
import { bannerUpsertSchema, navigationUpsertSchema, parseSectionForm } from '@/lib/admin/content-validation'
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

export async function deleteContentItem(kind: 'banner' | 'section' | 'navigation', id: string): Promise<AdminActionState> {
  const denied = await gate(); if (denied) return denied
  const table = kind === 'banner' ? 'banners' : kind === 'section' ? 'homepage_sections' : 'navigation_items'
  const { error } = await getSupabaseAdminClient().from(table).delete().eq('id', id)
  if (error) return fail('INTERNAL_ERROR')
  refreshContent(); return { ok: true, message: 'Đã xóa nội dung.' }
}
