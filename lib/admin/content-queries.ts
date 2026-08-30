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
export type AdminFlashOffer = {
  id: string; productId: string; productName: string; title: string; badge: string
  startsAt: string | null; endsAt: string; sortOrder: number; isActive: boolean
}
export type AdminProductOption = { id: string; name: string; slug: string }

export async function listAdminContent(): Promise<{
  banners: AdminBanner[]
  sections: AdminHomepageSection[]
  navigation: AdminNavigationItem[]
  flashOffers: AdminFlashOffer[]
  productOptions: AdminProductOption[]
}> {
  const db = getSupabaseAdminClient()
  const [banners, sections, navigation, flashOffers, productOptions] = await Promise.all([
    db.from('banners').select('*').order('sort_order').order('id'),
    db.from('homepage_sections').select('*').order('sort_order').order('id'),
    db.from('navigation_items').select('*').order('sort_order').order('id'),
    db.from('flash_offers')
      .select('id, product_id, title, badge, starts_at, ends_at, sort_order, is_active, products!inner(id, name, slug)')
      .order('sort_order')
      .order('id'),
    // Product picker source: capped so the admin page stays bounded.
    db.from('products').select('id, name, slug').eq('is_published', true).eq('is_archived', false).order('name').limit(200),
  ])
  const error = banners.error ?? sections.error ?? navigation.error ?? flashOffers.error ?? productOptions.error
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
    flashOffers: (flashOffers.data ?? []).map((row) => {
      const product = (Array.isArray(row.products) ? row.products[0] : row.products) as
        | { id: string; name: string; slug: string }
        | undefined
      return {
        id: row.id, productId: row.product_id, productName: product?.name ?? '',
        title: row.title, badge: row.badge, startsAt: row.starts_at,
        endsAt: row.ends_at, sortOrder: row.sort_order, isActive: row.is_active,
      }
    }),
    productOptions: (productOptions.data ?? []).map((row) => ({
      id: row.id, name: row.name, slug: row.slug,
    })),
  }
}
