'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons'
import { formatPrice } from '@/lib/format'

export interface HeroSlideItem {
  id: string
  title: string
  subtitle?: string | null
  eyebrow?: string | null
  href: string
  ctaLabel?: string
  imageUrl?: string | null
  imageAlt?: string | null
  price?: number | null
  badge?: string | null
  brandName?: string | null
  isProduct?: boolean
  tabTitle: string
  tabDesc?: string | null
}

interface HeroSliderProps {
  slides: HeroSlideItem[]
  autoPlayIntervalMs?: number
}

/**
 * Editorial light-theme hero slider for the TechStore customer experience.
 *
 * Designed to seamlessly blend with the storefront's light theme:
 * - Proper content containment: text never overlaps, image never overflows borders.
 * - Single responsive grid layout (50/50 desktop split, stacked on mobile).
 * - Interactive product tabs with thumbnails and auto-play progress.
 * - Touch swipe and pause-on-hover.
 */
export function HeroSlider({ slides, autoPlayIntervalMs = 4500 }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progressKey, setProgressKey] = useState(0)

  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const total = slides.length

  const nextSlide = useCallback(() => {
    if (total <= 1) return
    setActiveIndex((prev) => (prev + 1) % total)
    setProgressKey((k) => k + 1)
  }, [total])

  const prevSlide = useCallback(() => {
    if (total <= 1) return
    setActiveIndex((prev) => (prev - 1 + total) % total)
    setProgressKey((k) => k + 1)
  }, [total])

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index)
    setProgressKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (total <= 1 || isPaused) return

    const timer = setInterval(() => {
      nextSlide()
    }, autoPlayIntervalMs)

    return () => clearInterval(timer)
  }, [total, isPaused, autoPlayIntervalMs, nextSlide])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    touchEndX.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const diff = touchStartX.current - touchEndX.current
    if (diff > 45) {
      nextSlide()
    } else if (diff < -45) {
      prevSlide()
    }
    touchStartX.current = null
    touchEndX.current = null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide()
    } else if (e.key === 'ArrowRight') {
      nextSlide()
    }
  }

  if (total === 0) return null

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Khung sản phẩm nổi bật"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated text-fg shadow-sm transition-all duration-300 hover:border-brand/40 hover:shadow-md outline-none"
    >
      {/* Background ambient light gradient */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl"
        aria-hidden="true"
      />

      {/* Main Slide Stage */}
      <div className="relative min-h-[380px] w-full flex-1 overflow-hidden sm:min-h-[400px] lg:h-[400px] xl:h-[420px]">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex
          const isBannerWithArtwork = !slide.isProduct && Boolean(slide.imageUrl)

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} trên ${total}: ${slide.title}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex flex-col justify-center transition-all duration-500 ease-out ${
                isActive
                  ? 'pointer-events-auto z-10 translate-x-0 scale-100 opacity-100'
                  : 'pointer-events-none z-0 scale-[0.98] opacity-0'
              }`}
            >
              {/* Full-width artwork banner mode */}
              {isBannerWithArtwork && slide.imageUrl ? (
                <div className="absolute inset-0 z-0">
                  <Image
                    src={slide.imageUrl}
                    alt={slide.imageAlt ?? slide.title}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1024px) 100vw, 75vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
                </div>
              ) : null}

              <Link
                href={slide.href}
                tabIndex={isActive ? 0 : -1}
                className="group/slide relative z-10 flex h-full w-full flex-col justify-center p-4 sm:p-6 lg:p-7"
              >
                <div className="grid h-full w-full grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-8">
                  {/* Info column */}
                  <div className="z-10 flex flex-col justify-center gap-2.5 sm:gap-3 lg:col-span-6 min-w-0">
                    {/* Eyebrow and badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          isBannerWithArtwork
                            ? 'border border-cyan-400/40 bg-cyan-950/60 text-cyan-300'
                            : 'border border-brand/20 bg-brand-soft text-brand'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                        {slide.eyebrow ?? 'ƯU ĐÃI ĐẶC QUYỀN'}
                      </span>
                      {slide.badge ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                          {slide.badge}
                        </span>
                      ) : null}
                    </div>

                    {/* Main Heading */}
                    {isActive ? (
                      <h1
                        id="hero-heading"
                        className={`text-balance text-xl font-extrabold leading-snug tracking-tight line-clamp-2 sm:text-2xl lg:text-3xl ${
                          isBannerWithArtwork ? 'text-white drop-shadow-md' : 'text-fg'
                        }`}
                      >
                        {slide.title}
                      </h1>
                    ) : (
                      <p
                        className={`text-balance text-xl font-extrabold leading-snug tracking-tight line-clamp-2 sm:text-2xl lg:text-3xl ${
                          isBannerWithArtwork ? 'text-white' : 'text-fg'
                        }`}
                      >
                        {slide.title}
                      </p>
                    )}

                    {/* Subtitle */}
                    {slide.subtitle ? (
                      <p
                        className={`max-w-md text-xs sm:text-sm font-normal leading-relaxed line-clamp-2 ${
                          isBannerWithArtwork ? 'text-slate-200' : 'text-fg-muted'
                        }`}
                      >
                        {slide.subtitle}
                      </p>
                    ) : null}

                    {/* Price and Stock status */}
                    {slide.price !== undefined && slide.price !== null ? (
                      <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${
                            isBannerWithArtwork ? 'text-slate-300' : 'text-fg-subtle'
                          }`}
                        >
                          Giá từ:
                        </span>
                        <span
                          className={`font-mono text-xl sm:text-2xl lg:text-3xl font-black tracking-tight ${
                            isBannerWithArtwork ? 'text-amber-300 drop-shadow-sm' : 'text-brand'
                          }`}
                        >
                          {formatPrice(slide.price)}
                        </span>
                        {slide.isProduct ? (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Chính hãng 100%
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* CTA Button */}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-2 rounded-(--radius-md) bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition-all duration-200 group-hover/slide:bg-brand-hover group-hover/slide:shadow group-hover/slide:translate-x-0.5 sm:text-sm">
                        {slide.ctaLabel ?? 'Xem chi tiết'}
                        <IconChevronRight size={15} />
                      </span>
                    </div>
                  </div>

                  {/* Product showcase column */}
                  {!isBannerWithArtwork ? (
                    <div className="relative flex h-[190px] sm:h-[240px] lg:h-[300px] xl:h-[320px] w-full items-center justify-center lg:col-span-6">
                      {slide.imageUrl ? (
                        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 p-3 sm:p-4 shadow-xs transition-all duration-300 group-hover/slide:border-brand/40 group-hover/slide:shadow-sm">
                          <div className="relative h-full w-full transition-transform duration-500 ease-out group-hover/slide:scale-105">
                            <Image
                              src={slide.imageUrl}
                              alt={slide.imageAlt ?? slide.title}
                              fill
                              sizes="(max-width: 1024px) 90vw, 420px"
                              priority={index === 0}
                              className="select-none object-contain"
                            />
                          </div>

                          {slide.brandName ? (
                            <div className="absolute right-3 top-3 z-10 rounded-full border border-border bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-fg-muted shadow-xs">
                              {slide.brandName}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border bg-bg-secondary/40 p-6 text-center">
                          <div>
                            <span className="text-2xl font-black text-brand">TechStore</span>
                            <p className="mt-1 text-xs text-fg-muted">
                              Công nghệ chính hãng · Giá tốt mỗi ngày
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {/* Navigation Arrows */}
      {total > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              prevSlide()
            }}
            aria-label="Slide trước"
            className="absolute left-2.5 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 text-fg shadow-md transition-all duration-200 hover:border-brand hover:text-brand hover:scale-105 active:scale-95 focus:opacity-100 opacity-0 group-hover:opacity-90"
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              nextSlide()
            }}
            aria-label="Slide tiếp theo"
            className="absolute right-2.5 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 text-fg shadow-md transition-all duration-200 hover:border-brand hover:text-brand hover:scale-105 active:scale-95 focus:opacity-100 opacity-0 group-hover:opacity-90"
          >
            <IconChevronRight size={18} />
          </button>
        </>
      ) : null}

      {/* Bottom Interactive Product Tabs with Mini Thumbnails (CellphoneS Inspired) */}
      {total > 1 ? (
        <div className="relative z-20 border-t border-border bg-bg-secondary/40">
          <div className="flex overflow-x-auto no-scrollbar snap-x lg:grid lg:grid-flow-col lg:auto-cols-fr lg:divide-x lg:divide-border">
            {slides.map((s, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  className={`relative flex min-w-[140px] flex-1 shrink-0 snap-start items-center gap-2 px-3 py-2 text-left transition-colors sm:px-3.5 sm:py-2.5 ${
                    isActive
                      ? 'bg-white text-brand shadow-xs'
                      : 'text-fg-muted hover:bg-white/60 hover:text-fg'
                  }`}
                >
                  {/* Progress bar on top of the active tab */}
                  {isActive ? (
                    <div className="absolute top-0 left-0 right-0 h-[2.5px] overflow-hidden bg-brand/15">
                      <div
                        key={progressKey}
                        className={`h-full bg-brand ${isPaused ? 'pause-animation' : ''}`}
                        style={{
                          animation: `hero-progress ${autoPlayIntervalMs}ms linear forwards`,
                        }}
                      />
                    </div>
                  ) : null}

                  {/* Thumbnail in tab */}
                  {s.imageUrl ? (
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-border bg-white p-0.5 shadow-2xs">
                      <Image
                        src={s.imageUrl}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-contain"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs ${
                        isActive ? 'font-bold text-brand' : 'font-semibold text-fg'
                      }`}
                    >
                      {s.tabTitle}
                    </span>
                    {s.tabDesc ? (
                      <span className="block truncate text-[11px] font-medium text-fg-subtle">
                        {s.tabDesc}
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
