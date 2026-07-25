'use client'

import Image from 'next/image'
import { useState } from 'react'

import type { ProductImageData } from '@/lib/catalog/types'

interface ProductGalleryProps {
  images: ProductImageData[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

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
                    'relative size-16 overflow-hidden rounded-(--radius-md) border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isActive ? 'border-accent' : 'border-border hover:border-border-strong',
                  ].join(' ')}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
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
