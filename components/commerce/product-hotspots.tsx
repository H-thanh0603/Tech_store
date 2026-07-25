'use client'

import Image from 'next/image'
import { useState } from 'react'

import type { ProductHotspot } from '@/lib/catalog/social'

export function ProductHotspots({
  imageUrl,
  imageAlt,
  hotspots,
}: {
  imageUrl: string | null
  imageAlt: string
  hotspots: ProductHotspot[]
}) {
  const [activeId, setActiveId] = useState<string | null>(hotspots[0]?.id ?? null)
  const active = hotspots.find((h) => h.id === activeId) ?? hotspots[0]

  if (hotspots.length === 0 || !imageUrl) return null

  return (
    <section aria-labelledby="hotspot-heading" className="border-t border-border pt-10">
      <p className="eyebrow">Spotlight</p>
      <h2 id="hotspot-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight">
        Điểm nổi bật trên máy
      </h2>
      <p className="mt-1 max-w-xl text-(length:--text-sm) text-fg-muted">
        Chạm vào các điểm để xem giải thích — mobile dùng danh sách bên dưới.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-xl) border border-border bg-surface-muted">
          <Image src={imageUrl} alt={imageAlt} fill sizes="(max-width:1024px) 100vw, 55vw" className="object-cover" />
          {hotspots.map((h) => {
            const isActive = h.id === active?.id
            return (
              <button
                key={h.id}
                type="button"
                className={`absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-(length:--text-xs) font-bold shadow-(--shadow-md) transition-transform ${
                  isActive
                    ? 'scale-110 border-white bg-brand text-accent-fg'
                    : 'border-white/90 bg-surface-inverse/80 text-fg-inverse hover:scale-105'
                }`}
                style={{ left: `${h.xPercent}%`, top: `${h.yPercent}%` }}
                aria-pressed={isActive}
                aria-label={h.label}
                onClick={() => setActiveId(h.id)}
              >
                +
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          {hotspots.map((h) => {
            const isActive = h.id === active?.id
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setActiveId(h.id)}
                className={`rounded-(--radius-lg) border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-brand bg-brand-soft shadow-(--shadow-sm)'
                    : 'border-border bg-bg-elevated hover:bg-surface-muted'
                }`}
              >
                <p className="font-semibold text-fg">{h.label}</p>
                <p className="mt-1 text-(length:--text-sm) leading-relaxed text-fg-muted">{h.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
