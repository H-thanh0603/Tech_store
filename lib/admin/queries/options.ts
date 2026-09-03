import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { BrandOption, CategoryOption } from '@/lib/admin/types'

export async function listCategories(): Promise<CategoryOption[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }))
}

export async function listBrands(): Promise<BrandOption[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('brands')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }))
}
