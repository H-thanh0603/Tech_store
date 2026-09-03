import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { asRecord, num } from './shared'

export async function listAdminCustomers(filter?: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<import('@/lib/admin/types').AdminCustomerListResult> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_customers', {
    p_search: filter?.q || null,
    p_page: filter?.page ?? 1,
    p_page_size: filter?.pageSize ?? 20,
  })
  if (error) throw error
  const root = asRecord(data)
  const rows = (Array.isArray(root.rows) ? root.rows : []).map((item) => {
    const row = asRecord(item)
    return {
      key: String(row.key),
      name: String(row.name),
      phone: String(row.phone),
      email: row.email == null ? null : String(row.email),
      orderCount: num(row.orderCount),
      totalSpent: num(row.totalSpent),
      lastOrderAt: String(row.lastOrderAt),
      lastOrderCode: String(row.lastOrderCode),
    }
  })
  return {
    total: num(root.total),
    page: num(root.page) || 1,
    pageSize: num(root.pageSize) || 20,
    pageCount: Math.max(1, num(root.pageCount) || 1),
    rows,
    source: String(root.source ?? 'orders_aggregate'),
  }
}
