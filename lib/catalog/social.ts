import { getSupabaseServerClient } from '@/lib/supabase/server'

export type ProductReview = {
  id: string
  authorName: string
  rating: number
  title: string | null
  body: string
  createdAt: string
}

export type ProductHotspot = {
  id: string
  label: string
  description: string
  xPercent: number
  yPercent: number
}

export type FlashOfferCard = {
  id: string
  title: string
  badge: string
  endsAt: string
  product: {
    id: string
    slug: string
    name: string
    minPrice: number
    compareAt: number | null
    imageUrl: string | null
    availableStock: number
  }
}

export async function getProductReviews(productId: string, limit = 12): Promise<ProductReview[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('public_product_reviews')
    .select('id, author_name, rating, title, body, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => ({
    id: row.id as string,
    authorName: row.author_name as string,
    rating: row.rating as number,
    title: (row.title as string | null) ?? null,
    body: row.body as string,
    createdAt: row.created_at as string,
  }))
}

export async function getProductHotspots(productId: string): Promise<ProductHotspot[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('product_hotspots')
    .select('id, label, description, x_percent, y_percent')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return data.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    description: row.description as string,
    xPercent: Number(row.x_percent),
    yPercent: Number(row.y_percent),
  }))
}

export async function getActiveFlashOffers(limit = 6): Promise<FlashOfferCard[]> {
  const supabase = getSupabaseServerClient()
  const { data: offers, error } = await supabase
    .from('flash_offers')
    .select('id, title, badge, ends_at, product_id')
    .eq('is_active', true)
    // RLS also enforces the live window; repeat it here so the admin preview
    // path (service role) and any policy drift behave identically.
    .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
    .gt('ends_at', new Date().toISOString())
    .order('sort_order', { ascending: true })
    .limit(limit)

  if (error || !offers?.length) return []

  const productIds = offers.map((o) => o.product_id as string)
  const { data: products } = await supabase
    .from('catalog_products')
    .select('id, slug, name, min_price, has_discount, image_url, available_stock')
    .in('id', productIds)

  const byId = new Map((products ?? []).map((p) => [p.id as string, p]))

  // Optional regular price for strikethrough when discounted
  const { data: variants } = await supabase
    .from('product_variants')
    .select('product_id, regular_price, sale_price')
    .in('product_id', productIds)
    .eq('is_active', true)

  const compareByProduct = new Map<string, number>()
  for (const v of variants ?? []) {
    const pid = v.product_id as string
    const sale = v.sale_price != null ? Number(v.sale_price) : null
    const regular = Number(v.regular_price)
    if (sale != null && sale < regular) {
      const prev = compareByProduct.get(pid)
      if (prev === undefined || regular > prev) compareByProduct.set(pid, regular)
    }
  }

  return offers
    .map((o) => {
      const p = byId.get(o.product_id as string)
      if (!p) return null
      const minPrice = Number(p.min_price)
      const compareAt = compareByProduct.get(p.id as string) ?? null
      return {
        id: o.id as string,
        title: o.title as string,
        badge: o.badge as string,
        endsAt: o.ends_at as string,
        product: {
          id: p.id as string,
          slug: p.slug as string,
          name: p.name as string,
          minPrice,
          compareAt: compareAt != null && compareAt > minPrice ? compareAt : null,
          imageUrl: (p.image_url as string | null) ?? null,
          availableStock: Number(p.available_stock ?? 0),
        },
      } satisfies FlashOfferCard
    })
    .filter((x): x is FlashOfferCard => Boolean(x))
}

export async function getReviewSummary(productId: string): Promise<{
  average: number
  count: number
}> {
  const reviews = await getProductReviews(productId, 100)
  if (reviews.length === 0) return { average: 0, count: 0 }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length }
}
