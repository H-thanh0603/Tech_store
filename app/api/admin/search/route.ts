import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin/auth'
import { canAccessModule } from '@/lib/admin/permissions'
import { listAdminCustomers } from '@/lib/admin/queries/customers'
import { listAdminOrders } from '@/lib/admin/queries/orders'
import { listAdminProducts } from '@/lib/admin/queries/products'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Unified admin search for the Cmd+K palette: orders + products + customers.
// Each section is gated by its module permission — a role without orders
// access gets no order rows. Throttled: 60/min per admin.

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: 'admin_search',
      p_identity: session.userId,
      p_limit: 60,
      p_window_minutes: 1,
    })
    if (limited === true) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
  } catch {
    // fail-open: search stays usable if the limiter RPC is missing
  }

  let q = ''
  try {
    q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  } catch {
    q = ''
  }
  if (q.length < 2) {
    return NextResponse.json({ orders: [], products: [], customers: [] })
  }

  const [orders, products, customers] = await Promise.all([
    canAccessModule(session.role, 'orders')
      ? listAdminOrders({ q, pageSize: 5 }).catch(() => null)
      : null,
    canAccessModule(session.role, 'products')
      ? listAdminProducts({ q, pageSize: 5 }).catch(() => null)
      : null,
    canAccessModule(session.role, 'customers')
      ? listAdminCustomers({ q, pageSize: 5 }).catch(() => null)
      : null,
  ])

  return NextResponse.json({
    orders: (orders?.rows ?? []).map((o) => ({
      href: `/admin/orders/${o.orderCode}`,
      title: o.orderCode,
      subtitle: `${o.customerName} · ${o.customerPhone}`,
    })),
    products: (products?.rows ?? []).map((p) => ({
      href: `/admin/products/${p.id}`,
      title: p.name,
      subtitle: p.slug,
    })),
    customers: (customers?.rows ?? []).map((c) => ({
      href: `/admin/customers?phone=${encodeURIComponent(c.phone)}`,
      title: c.name || c.phone,
      subtitle: `${c.phone} · ${c.orderCount} đơn`,
    })),
  })
}
