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

// Compact variant for product detail / cart — supports excludeId and denser layout
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const items = useSyncExternalStore(
    subscribeLists,
    getRecentlyViewedSnapshot,
    getServerListSnapshot,
  )
  const filtered = excludeId ? items.filter((p) => p.id !== excludeId) : items
  if (filtered.length === 0) return null
  const visible = filtered.slice(0, 6)
  return (
    <section aria-labelledby="recently-viewed-heading">
      <SectionHeader
        eyebrow="Đã xem"
        title="Vừa xem"
        titleId="recently-viewed-heading"
        description="Quay lại nhanh sản phẩm bạn vừa quan tâm."
      />
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {visible.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group min-w-[10rem] max-w-[10rem] shrink-0 overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised transition hover:border-brand/30 hover:shadow-(--shadow-sm)"
            onClick={() => track('recently_viewed_click', { productId: product.id })}
          >
            <div className="relative aspect-square overflow-hidden bg-surface-muted">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  sizes="10rem"
                />
              ) : (
                <div className="grid size-full place-items-center text-fg-subtle">—</div>
              )}
            </div>
            <div className="p-2.5">
              {product.brandName ? (
                <p className="truncate text-(length:--text-2xs) font-semibold uppercase tracking-wide text-fg-subtle">
                  {product.brandName}
                </p>
              ) : null}
              <p className="line-clamp-2 text-(length:--text-sm) font-medium leading-tight text-fg group-hover:text-brand">
                {product.name}
              </p>
              <p className="mt-1 text-(length:--text-sm) font-semibold tabular-nums text-fg">
                {formatPrice(product.minPrice)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
