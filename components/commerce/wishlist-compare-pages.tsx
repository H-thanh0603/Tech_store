'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'

import { formatPrice } from '@/lib/format'
import {
  clearCompare,
  getCompareSnapshot,
  getServerListSnapshot,
  getWishlistSnapshot,
  subscribeLists,
  toggleCompare,
  toggleWishlist,
} from '@/lib/customer/local-lists'

export function WishlistClient() {
  const items = useSyncExternalStore(subscribeLists, getWishlistSnapshot, getServerListSnapshot)

  return (
    <section>
      <p className="eyebrow">Đã lưu</p>
      <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">Wishlist</h1>
      <p className="mt-1 text-(length:--text-sm) text-fg-muted">
        Lưu trên trình duyệt của bạn — không đồng bộ tài khoản.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-(--radius-xl) border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="font-semibold">Chưa có sản phẩm</p>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">
            Bấm ♥ trên card sản phẩm để lưu.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-brand"
          >
            Xem catalog →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-bg-elevated shadow-(--shadow-sm)"
            >
              <Link href={`/products/${item.slug}`} className="relative aspect-[4/3] bg-surface-muted">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt="" fill sizes="25vw" className="object-cover" />
                ) : null}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <Link
                  href={`/products/${item.slug}`}
                  className="line-clamp-2 font-semibold text-fg hover:text-brand"
                >
                  {item.name}
                </Link>
                <p className="tabular-nums font-semibold">{formatPrice(item.minPrice)}</p>
                <button
                  type="button"
                  className="mt-auto min-h-11 rounded-(--radius-md) border border-border text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted"
                  onClick={() => toggleWishlist(item)}
                >
                  Bỏ khỏi wishlist
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function CompareClient() {
  const items = useSyncExternalStore(subscribeLists, getCompareSnapshot, getServerListSnapshot)

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">So sánh</p>
          <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">
            So sánh sản phẩm
          </h1>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">
            Tối đa 4 sản phẩm · dữ liệu lưu trên thiết bị.
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            className="min-h-11 rounded-(--radius-md) border border-border px-4 text-(length:--text-sm) font-medium"
            onClick={() => clearCompare()}
          >
            Xóa tất cả
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-(--radius-xl) border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="font-semibold">Chưa chọn sản phẩm để so sánh</p>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">
            Bấm ⇄ trên card sản phẩm (tối đa 4).
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex min-h-11 items-center text-(length:--text-sm) font-semibold text-brand"
          >
            Xem catalog →
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-(length:--text-sm)">
            <thead>
              <tr>
                <th className="w-28 p-3 text-fg-muted">Thuộc tính</th>
                {items.map((item) => (
                  <th key={item.id} className="min-w-44 border-l border-border p-3 align-top">
                    <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-(--radius-md) bg-surface-muted">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="180px" className="object-cover" />
                      ) : null}
                    </div>
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-semibold text-fg hover:text-brand"
                    >
                      {item.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th className="p-3 font-medium text-fg-muted">Hãng</th>
                {items.map((item) => (
                  <td key={item.id} className="border-l border-border p-3">
                    {item.brandName ?? '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <th className="p-3 font-medium text-fg-muted">Danh mục</th>
                {items.map((item) => (
                  <td key={item.id} className="border-l border-border p-3">
                    {item.categorySlug}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <th className="p-3 font-medium text-fg-muted">Giá từ</th>
                {items.map((item) => (
                  <td key={item.id} className="border-l border-border p-3 font-semibold tabular-nums">
                    {formatPrice(item.minPrice)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <th className="p-3 font-medium text-fg-muted">Thao tác</th>
                {items.map((item) => (
                  <td key={item.id} className="border-l border-border p-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/products/${item.slug}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-(--radius-md) bg-brand px-3 text-(length:--text-xs) font-semibold text-accent-fg"
                      >
                        Xem chi tiết
                      </Link>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-(--radius-md) border border-border text-(length:--text-xs) font-medium"
                        onClick={() => toggleCompare(item)}
                      >
                        Bỏ so sánh
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
