'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { formatPrice } from '@/lib/format'
import type { FlashOfferCard } from '@/lib/catalog/social'

function useCountdown(endsAt: string) {
  // Start null so SSR and the first client render agree; the live value only
  // exists after mount (a Date.now()-seeded initial state hydrafies mismatched
  // countdown text between server and client).
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (left === null) return { h: 0, m: 0, sec: 0, expired: false, pending: true }
  const s = Math.floor(left / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return { h, m, sec, expired: left <= 0, pending: false }
}

function CountdownBadge({ endsAt }: { endsAt: string }) {
  const { h, m, sec, expired, pending } = useCountdown(endsAt)
  if (pending) {
    return <span className="tabular-nums text-(length:--text-xs) font-semibold text-fg-muted">--:--:--</span>
  }
  if (expired) {
    return <span className="text-(length:--text-xs) font-semibold text-fg-muted">Đã hết hạn</span>
  }
  return (
    <span className="tabular-nums text-(length:--text-xs) font-semibold text-sale">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
    </span>
  )
}

export function FlashSaleSection({ offers }: { offers: FlashOfferCard[] }) {
  if (offers.length === 0) return null

  return (
    <section aria-labelledby="flash-heading" className="section-y border-b border-border bg-danger-subtle/30">
      <div className="container-store">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-sale">Flash sale</p>
            <h2 id="flash-heading" className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">
              Ưu đãi có hạn — countdown thật
            </h2>
            <p className="mt-1 text-(length:--text-sm) text-fg-muted">
              Chỉ hiển thị offer còn hạn từ database. Không fake scarcity.
            </p>
          </div>
          <Link href="/products" className="text-(length:--text-sm) font-semibold text-brand">
            Xem catalog →
          </Link>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <li key={offer.id}>
              <Link
                href={`/products/${offer.product.slug}`}
                className="reveal-soft flex h-full flex-col overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-(--shadow-sm)"
              >
                <div className="relative aspect-[4/3] bg-surface-muted">
                  {offer.product.imageUrl ? (
                    <Image
                      src={offer.product.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-sale px-2.5 py-1 text-(length:--text-xs) font-bold text-white">
                    {offer.badge}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                      {offer.product.availableStock > 0
                        ? `Còn ${offer.product.availableStock} sản phẩm`
                        : 'Hết hàng'}
                    </p>
                    <CountdownBadge endsAt={offer.endsAt} />
                  </div>
                  <p className="line-clamp-2 font-semibold text-fg">{offer.product.name}</p>
                  <p className="mt-auto flex items-baseline gap-2">
                    <span className="text-(length:--text-lg) font-semibold tabular-nums text-sale">
                      {formatPrice(offer.product.minPrice)}
                    </span>
                    {offer.product.compareAt ? (
                      <span className="text-(length:--text-sm) tabular-nums text-fg-subtle line-through">
                        {formatPrice(offer.product.compareAt)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
