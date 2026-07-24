'use client'

import { useState } from 'react'

import type { ProductImageData } from '@/lib/catalog/types'

interface ProductGalleryProps {
  images: ProductImageData[]
  productName: string
}

// Client gallery: a main image plus thumbnails. Falls back to a placeholder
// panel when a product has no images (seed: Dell XPS 13). Images are the demo
// placehold.co URLs, so a plain img avoids next/image domain config coupling.
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-(--radius-lg) border border-border bg-surface-muted text-(length:--text-sm) text-fg-subtle"
        aria-hidden="true"
      >
        Chưa có ảnh
      </div>
    )
  }

  const active = images[Math.min(activeIndex, images.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-(--radius-lg) border border-border bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={active.alt ?? productName}
          width={800}
          height={800}
          className="h-full w-full object-cover"
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((image, index) => {
            const isActive = index === activeIndex
            return (
              <li key={image.url}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={isActive}
                  aria-label={`Ảnh ${index + 1}`}
                  className={[
                    'size-16 overflow-hidden rounded-(--radius-md) border',
                    isActive ? 'border-accent' : 'border-border hover:border-border-strong',
                  ].join(' ')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
