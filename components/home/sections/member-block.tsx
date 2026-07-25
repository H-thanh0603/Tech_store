'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

import { useListCounts } from '@/components/commerce/list-toggles'
import type { SectionProps } from '@/components/home/sections/types'
import {
  IconHeart,
  IconMapPin,
  IconReceipt,
  IconShieldCheck,
  IconUser,
} from '@/components/ui/icons'
import { getProfile, getSavedOrders, subscribeCustomer } from '@/lib/customer/profile'

/**
 * Member welcome block (§4.3).
 *
 * Deliberately claims only what the product actually does today: saved delivery
 * details that prefill checkout, a wishlist/compare list, and saved order codes.
 * No loyalty points and no voucher wallet — inventing a rewards balance would be
 * the exact kind of fake UI the spec forbids.
 *
 * Everything is read from local storage, so this renders per device and needs no
 * auth round-trip on the homepage.
 */

const EMPTY_ORDERS: ReturnType<typeof getSavedOrders> = []

function profileSnapshot() {
  return getProfile()
}

function serverProfileSnapshot() {
  return getProfile()
}

function ordersSnapshot() {
  return getSavedOrders()
}

function serverOrdersSnapshot() {
  return EMPTY_ORDERS
}

export function MemberBlockSection({ section }: SectionProps) {
  const profile = useSyncExternalStore(subscribeCustomer, profileSnapshot, serverProfileSnapshot)
  const orders = useSyncExternalStore(subscribeCustomer, ordersSnapshot, serverOrdersSnapshot)
  const { wishCount, compareCount } = useListCounts()

  const hasProfile = Boolean(profile.fullName || profile.phone || profile.city)
  const latestOrder = orders[0] ?? null

  return (
    <section
      aria-labelledby="member-heading"
      className="border-b border-border bg-bg-elevated"
    >
      <div className="container-store grid gap-5 py-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
          <h2
            id="member-heading"
            className="mt-1 text-balance text-(length:--text-2xl) font-semibold tracking-tight text-fg"
          >
            {hasProfile && profile.fullName
              ? `Chào ${profile.fullName}`
              : (section.title ?? 'Mua nhanh hơn ở lần sau')}
          </h2>
          {section.subtitle ? (
            <p className="mt-2 max-w-xl text-(length:--text-sm) leading-relaxed text-fg-muted">
              {section.subtitle}
            </p>
          ) : null}

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            <Benefit icon={IconUser} label="Lưu tên & số điện thoại cho checkout" />
            <Benefit icon={IconMapPin} label="Nhớ khu vực giao hàng đã chọn" />
            <Benefit icon={IconHeart} label="Wishlist và so sánh giữ lại trên máy" />
            <Benefit icon={IconReceipt} label="Danh sách mã đơn để tra cứu nhanh" />
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/account"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
            >
              {hasProfile ? 'Mở tài khoản' : 'Thiết lập thông tin'}
            </Link>
            <Link
              href="/account/login"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold text-fg hover:bg-surface-muted"
            >
              Đăng nhập / Đăng ký
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-(--radius-lg) border border-border bg-bg-secondary/60 p-4 sm:grid-cols-4 lg:grid-cols-2">
          <Stat label="Wishlist" value={String(wishCount)} />
          <Stat label="Đang so sánh" value={String(compareCount)} />
          <Stat label="Đơn đã lưu" value={String(orders.length)} />
          <Stat
            label="Khu vực giao"
            value={profile.city || 'Chưa chọn'}
            href={profile.city ? undefined : '/account'}
          />
          {latestOrder ? (
            <div className="col-span-2 border-t border-border pt-3 sm:col-span-4 lg:col-span-2">
              <dt className="text-(length:--text-xs) text-fg-subtle">Đơn gần nhất</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/orders/${latestOrder.code}`}
                  className="inline-flex min-h-9 items-center gap-1.5 text-(length:--text-sm) font-semibold text-brand hover:underline"
                >
                  <IconShieldCheck size={16} />
                  {latestOrder.code}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  )
}

function Benefit({
  icon: Icon,
  label,
}: {
  icon: typeof IconUser
  label: string
}) {
  return (
    <li className="flex items-start gap-2 text-(length:--text-sm) text-fg-muted">
      <Icon size={17} className="mt-0.5 shrink-0 text-brand" />
      {label}
    </li>
  )
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-(length:--text-xs) text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-(length:--text-base) font-semibold tabular-nums text-fg">
        {href ? (
          <Link href={href} className="text-brand hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
