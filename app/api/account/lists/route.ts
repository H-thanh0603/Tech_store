import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

const item = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i), slug: z.string().min(1).max(200), name: z.string().min(1).max(300),
  brandName: z.string().max(120).nullable(), minPrice: z.number().nonnegative(),
  imageUrl: z.string().nullable(), categorySlug: z.string().max(120),
  savedAt: z.number().int().nonnegative(),
})
const lists = z.object({ wishlist: z.array(item).max(200), compare: z.array(item).max(4) })

async function clientAndUser() {
  const supabase = await createSupabaseAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await clientAndUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('customer_saved_products').select('list_type, snapshot, saved_at').order('saved_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const result: { wishlist: unknown[]; compare: unknown[] } = { wishlist: [], compare: [] }
  for (const row of data ?? []) {
    const parsed = item.safeParse({ ...(row.snapshot as object), savedAt: new Date(row.saved_at).getTime() })
    if (parsed.success) result[row.list_type as 'wishlist' | 'compare'].push(parsed.data)
  }
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { supabase, user } = await clientAndUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = lists.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const payload = {
    wishlist: parsed.data.wishlist.map(({ savedAt, ...snapshot }) => ({ ...snapshot, savedAt })),
    compare: parsed.data.compare.map(({ savedAt, ...snapshot }) => ({ ...snapshot, savedAt })),
  }
  const { data, error } = await supabase.rpc('customer_sync_saved_products', { p_lists: payload })
  if (error || (data as { code?: string } | null)?.code !== 'OK') {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
