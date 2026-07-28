'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { IconCheck, IconCopy, IconTag, IconX } from '@/components/ui/icons'

const PROMO_CODE = 'TECHWOW500'

export function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3600 * 5 + 42 * 60)

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('ts_promo_closed')
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [isOpen])

  const handleClose = () => {
    sessionStorage.setItem('ts_promo_closed', 'true')
    setIsOpen(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(PROMO_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!isOpen) return null

  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-2xl animate-scale-in">
        {/* Top Decorative Header */}
        <div className="relative bg-gradient-to-r from-brand via-brand-hover to-brand-electric p-6 text-white text-center">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng thông báo"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md transition-colors hover:bg-white/30"
          >
            <IconX size={18} />
          </button>
          
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-(length:--text-xs) font-extrabold uppercase tracking-wider backdrop-blur-md">
            <IconTag size={14} /> Ưu Đãi Độc Quyền
          </span>

          <h3 id="promo-popup-title" className="mt-3 text-2xl font-extrabold tracking-tight">
            TẶNG VOUCHER 500.000đ
          </h3>
          <p className="mt-1 text-sm text-white/90 font-medium">
            Áp dụng cho mọi đơn hàng thiết bị từ 5 Triệu
          </p>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide">
            Ưu đãi có hạn — Kết thúc sau
          </p>
          
          {/* Countdown Timer */}
          <div className="mt-2 flex justify-center gap-2 font-mono font-bold text-fg">
            <div className="rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-lg shadow-xs">
              {String(hours).padStart(2, '0')}
              <span className="block text-[10px] font-sans font-medium text-fg-subtle">Giờ</span>
            </div>
            <span className="self-center text-lg">:</span>
            <div className="rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-lg shadow-xs">
              {String(minutes).padStart(2, '0')}
              <span className="block text-[10px] font-sans font-medium text-fg-subtle">Phút</span>
            </div>
            <span className="self-center text-lg">:</span>
            <div className="rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-lg shadow-xs text-sale">
              {String(seconds).padStart(2, '0')}
              <span className="block text-[10px] font-sans font-medium text-fg-subtle">Giây</span>
            </div>
          </div>

          {/* Coupon Code Box */}
          <div className="mt-5 rounded-lg border border-dashed border-brand/50 bg-brand-soft/60 p-3.5 flex items-center justify-between gap-2">
            <div className="text-left">
              <span className="block text-[11px] font-semibold text-fg-subtle">Mã giảm giá của bạn</span>
              <span className="font-mono text-lg font-extrabold text-brand tracking-wider">{PROMO_CODE}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold transition-all ${
                copied
                  ? 'bg-success text-white'
                  : 'bg-brand text-white hover:bg-brand-hover shadow-xs'
              }`}
            >
              {copied ? (
                <>
                  <IconCheck size={16} /> Đã chép
                </>
              ) : (
                <>
                  <IconCopy size={16} /> Sao chép
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/products"
              onClick={handleClose}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-brand to-brand-hover px-5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
            >
              Áp dụng & Mua sắm ngay →
            </Link>
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-medium text-fg-subtle hover:text-fg underline-offset-2 hover:underline py-1"
            >
              Bỏ qua ưu đãi này
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
