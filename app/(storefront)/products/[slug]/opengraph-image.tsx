import { ImageResponse } from 'next/og'

import { getProductBySlug } from '@/lib/catalog/queries'
import { formatPrice } from '@/lib/format'

// Product OG image (1200x630) — auto-attached as og:image for this segment,
// but only when the page's generateMetadata omits `openGraph.images`; when a
// product photo exists, page.tsx keeps it (product photos win over generated
// cards). Generated cards cover products without photos.
//
// Cache: image routes honor route segment config like pages. revalidate=60
// matches the page's staleness so a price change refreshes both together.
export const revalidate = 60

export const alt = 'Sản phẩm tại TechStore'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Vietnamese product names can be long; wrap by words, cap at 3 lines (~60
// chars) so the price stays visible on the card.
function wrapName(name: string): string[] {
  const trimmed = name.length > 60 ? `${name.slice(0, 57).trimEnd()}…` : name
  const words = trimmed.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && `${current} ${word}`.length > 26) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug).catch(() => null)

  const nameLines = product ? wrapName(product.name) : ['Sản phẩm tại TechStore']
  const price = product ? formatPrice(product.minPrice) : null
  const brand = product?.brandName ?? null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #010b26 0%, #004bb3 60%, #005ccc 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 28px',
              borderRadius: '999px',
              background: '#0061e2',
              fontSize: '26px',
              fontWeight: 600,
            }}
          >
            TechStore
          </div>
          <div
            style={{
              padding: '10px 28px',
              borderRadius: '999px',
              border: '2px solid #4d94ff',
              fontSize: '26px',
              fontWeight: 600,
              color: '#e1f0ff',
            }}
          >
            Chính hãng
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {brand ? (
            <div
              style={{
                fontSize: '28px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: '#9db8e0',
              }}
            >
              {brand.toUpperCase()}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '64px', fontWeight: 700 }}>
            {nameLines.map((line) => (
              <div key={line} style={{ display: 'flex' }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        {price ? (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '56px', fontWeight: 700 }}>
            {price}
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  )
}
