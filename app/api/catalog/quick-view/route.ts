import { NextResponse } from 'next/server'

import { getProductBySlug } from '@/lib/catalog/queries'

// Quick view payload for the catalog modal: enough to preview and add the
// cheapest buyable variant to the cart without leaving the page.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'missing slug' }, { status: 400 })
  }

  try {
    const product = await getProductBySlug(slug)
    if (!product) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const buyable = product.variants
      .filter((v) => v.inStock)
      .sort((a, b) => a.price - b.price)[0]

    return NextResponse.json({
      name: product.name,
      slug: product.slug,
      description: product.description,
      imageUrl: product.images[0]?.url ?? null,
      imageAlt: product.images[0]?.alt ?? product.name,
      minPrice: product.minPrice,
      hasDiscount: product.hasDiscount,
      inStock: product.inStock,
      categoryName: product.categoryName,
      variantId: buyable?.id ?? null,
      variantPrice: buyable?.price ?? null,
      specs: product.specs.slice(0, 6),
    })
  } catch {
    return NextResponse.json({ error: 'failed to load product' }, { status: 500 })
  }
}
