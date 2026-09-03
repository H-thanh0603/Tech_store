'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { makeBackgroundInert, trapDialogTab } from '@/lib/a11y/dialog'
import type { ProductImageData } from '@/lib/catalog/types'

interface ProductGalleryProps {
  images: ProductImageData[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const lightboxRootRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (delta: number) => {
      if (images.length <= 1) return
      setActiveIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxOpen) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, lightboxOpen])

  useEffect(() => {
    if (!lightboxOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const restoreInert = makeBackgroundInert(lightboxRootRef.current)
    lightboxRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else trapDialogTab(e, lightboxRef.current)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      restoreInert()
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [lightboxOpen, go])

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
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Phóng to ảnh"
          className="absolute inset-0 z-10 cursor-zoom-in"
        />
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

      {lightboxOpen ? (
        <div ref={lightboxRootRef} className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setLightboxOpen(false)}
            className="absolute inset-0"
            tabIndex={-1}
          />
          <div
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh ${activeIndex + 1} / ${images.length} — ${productName}`}
            tabIndex={-1}
            className="relative m-auto flex max-h-[90vh] w-[min(90vw,64rem)] flex-col gap-4 p-4 focus:outline-none"
          >
            <div className="flex items-center justify-between text-white">
              <p className="text-(length:--text-sm) tabular-nums">
                {activeIndex + 1} / {images.length}
              </p>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-lg) bg-black">
              <Image src={active.url} alt={active.alt ?? productName} fill sizes="90vw" className="object-contain" />
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Ảnh trước"
                    className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Ảnh sau"
                    className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
                  >
                    ›
                  </button>
                </>
              ) : null}
            </div>
            <p className="text-center text-(length:--text-sm) text-white/80">{active.alt ?? productName}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
