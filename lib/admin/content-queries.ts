import { getSupabaseAdminClient } from '@/lib/admin/supabase'

export type AdminBanner = {
  id: string; name: string; slot: string; title: string | null; subtitle: string | null
  imageDesktopUrl: string | null; imageMobileUrl: string | null; href: string
  sortOrder: number; isActive: boolean
}
export type AdminHomepageSection = {
  id: string; sectionKey: string; sectionType: string; title: string | null
  subtitle: string | null; eyebrow: string | null; config: Record<string, unknown>
  sortOrder: number; isActive: boolean
}
export type AdminNavigationItem = {
  id: string; parentId: string | null; label: string; href: string | null; itemType: string
  iconKey: string | null; imageUrl: string | null; sortOrder: number
  isActive: boolean; openInNewTab: boolean
}

export async function listAdminContent(): Promise<{
  banners: AdminBanner[]
  sections: AdminHomepageSection[]
  navigation: AdminNavigationItem[]
}> {
  const db = getSupabaseAdminClient()
  const [banners, sections, navigation] = await Promise.all([
    db.from('banners').select('*').order('sort_order').order('id'),
    db.from('homepage_sections').select('*').order('sort_order').order('id'),
    db.from('navigation_items').select('*').order('sort_order').order('id'),
  ])
  const error = banners.error ?? sections.error ?? navigation.error
  if (error) throw error

  return {
    banners: (banners.data ?? []).map((row) => ({
      id: row.id, name: row.name, slot: row.slot, title: row.title, subtitle: row.subtitle,
      imageDesktopUrl: row.image_desktop_url, imageMobileUrl: row.image_mobile_url,
      href: row.href, sortOrder: row.sort_order, isActive: row.is_active,
    })),
    sections: (sections.data ?? []).map((row) => ({
      id: row.id, sectionKey: row.section_key, sectionType: row.section_type,
      title: row.title, subtitle: row.subtitle, eyebrow: row.eyebrow,
      config: row.config as Record<string, unknown>, sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
    navigation: (navigation.data ?? []).map((row) => ({
      id: row.id, parentId: row.parent_id, label: row.label, href: row.href,
      itemType: row.item_type, iconKey: row.icon_key, imageUrl: row.image_url,
      sortOrder: row.sort_order, isActive: row.is_active, openInNewTab: row.open_in_new_tab,
    })),
  }
}
