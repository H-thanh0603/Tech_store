'use client'

import { useEffect, useState } from 'react'
import { IconChevronRight, IconSupport, IconTag } from '@/components/ui/icons'

export function FloatingActions() {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const triggerVoucher = () => {
    sessionStorage.removeItem('ts_promo_closed')
    window.location.reload()
  }

  return (
    <div className="fixed right-4 bottom-20 lg:bottom-6 z-40 flex flex-col items-center gap-2.5">
      {/* Quick Promo Badge Button */}
      <button
        type="button"
        onClick={triggerVoucher}
        title="Nhận Voucher 500k"
        className="group relative flex size-12 items-center justify-center rounded-full bg-sale text-white shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95"
      >
        <IconTag size={20} className="animate-bounce" />
        <span className="absolute right-full mr-2 hidden rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white whitespace-nowrap shadow-md group-hover:block">
          🎁 Nhận Voucher 500k
        </span>
      </button>

      {/* Support / Hotline */}
      <div className="relative">
        <a
          href="tel:18006000"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Tư vấn hotline"
          className="flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95"
        >
          <IconSupport size={22} />
        </a>
        {showTooltip ? (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap shadow-md">
            Hotline: 1800.6000 (Miễn phí)
          </div>
        ) : null}
      </div>

      {/* Back to Top */}
      {showScrollTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Cuộn lên đầu trang"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg shadow-md transition-all hover:bg-brand hover:text-white hover:border-brand"
        >
          <IconChevronRight size={18} className="-rotate-90" />
        </button>
      ) : null}
    </div>
  )
}
