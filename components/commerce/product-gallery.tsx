'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

import type { ProductImageData } from '@/lib/catalog/types'

interface ProductGalleryProps {
  images: ProductImageData[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const go = useCallback(
    (delta: number) => {
      if (images.length <= 1) return
      setActiveIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-(--radius-xl) border border-border bg-surface-muted text-(length:--text-sm) text-fg-subtle shadow-(--shadow-sm)"
        aria-hidden="true"
      >
        <span className="grid size-14 place-items-center rounded-(--radius-md) border border-dashed border-border-strong">
          ▢
        </span>
        Chưa có ảnh
      </div>
    )
  }

  const active = images[Math.min(activeIndex, images.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-(--radius-xl) border border-border bg-surface-muted shadow-(--shadow-md)">
        <Image
          src={active.url}
          alt={active.alt ?? productName}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-elevated/95 text-fg shadow-(--shadow-sm)"
              aria-label="Ảnh trước"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-elevated/95 text-fg shadow-(--shadow-sm)"
              aria-label="Ảnh sau"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Ảnh sản phẩm">
          {images.map((image, index) => {
            const isActive = index === activeIndex
            return (
              <li key={`${image.url}-${index}`}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={isActive}
                  aria-label={`Ảnh ${index + 1}`}
                  className={[
                    'relative size-16 overflow-hidden rounded-(--radius-md) border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    isActive ? 'border-brand ring-1 ring-brand' : 'border-border hover:border-border-strong',
                  ].join(' ')}
                >
                  <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
