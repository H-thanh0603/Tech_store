import { ImageResponse } from 'next/og'

import { getSiteUrl } from '@/lib/site'

// Root OG image (1200x630) — auto-attached as og:image by the file convention.
// Fonts: @vercel/og's bundled Geist covers Vietnamese diacritics (verified);
// only "₫" falls back to a dynamic font fetch and degrades gracefully offline.

export const alt = 'TechStore — Công nghệ chọn lọc'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  const site = getSiteUrl()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #010b26 0%, #004bb3 60%, #005ccc 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '24px',
              background: '#0061e2',
              fontSize: '52px',
            }}
          >
            TS
          </div>
          <div style={{ fontSize: '110px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            TechStore
          </div>
        </div>
        <div
          style={{
            marginTop: '40px',
            fontSize: '44px',
            fontWeight: 500,
            color: '#e1f0ff',
          }}
        >
          Laptop · Điện thoại · Phụ kiện chính hãng
        </div>
        <div style={{ marginTop: '24px', fontSize: '30px', color: '#9db8e0' }}>{site}</div>
      </div>
    ),
    { ...size },
  )
}
