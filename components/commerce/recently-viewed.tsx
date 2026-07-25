'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'

import { SectionHeader } from '@/components/ui/section-header'
import { track } from '@/lib/analytics'
import {
  getRecentlyViewedSnapshot,
  getServerListSnapshot,
  subscribeLists,
} from '@/lib/customer/local-lists'
import { formatPrice } from '@/lib/format'

export function RecentlyViewedSection() {
  const items = useSyncExternalStore(
    subscribeLists,
    getRecentlyViewedSnapshot,
    getServerListSnapshot,
  )

  if (items.length === 0) return null

  return (
    <section aria-labelledby="recent-heading" className="section-y border-t border-border">
      <div className="container-store">
        <SectionHeader
          eyebrow="Gần đây"
          title="Bạn vừa xem"
          description="Lưu trên thiết bị của bạn — không cần đăng nhập."
          titleId="recent-heading"
        />
        <ul className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="w-44 shrink-0 snap-start">
              <Link
                href={`/products/${item.slug}`}
                className="reveal-soft flex h-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated shadow-(--shadow-sm)"
                onClick={() => track('recently_viewed_click', { productId: item.id })}
              >
                <span className="relative aspect-[4/3] bg-surface-muted">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" fill sizes="176px" className="object-cover" />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="line-clamp-2 text-(length:--text-sm) font-semibold text-fg">
                    {item.name}
                  </span>
                  <span className="text-(length:--text-sm) font-semibold tabular-nums">
                    {formatPrice(item.minPrice)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
