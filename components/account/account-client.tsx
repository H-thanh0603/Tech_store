'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  saveServerProfile,
  signInWithMagicLink,
  signInWithPassword,
  signOutAction,
  signUpWithPassword,
  type AuthFormState,
} from '@/lib/customer/auth-actions'
import { formatPrice } from '@/lib/format'
import { useOptionalToast } from '@/components/ui/toast'

const INITIAL: AuthFormState = { ok: true }

type ServerOrder = {
  orderCode: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  total: number
  createdAt: string
  itemCount: number
}

type ServerProfile = {
  fullName: string | null
  phone: string | null
  email: string | null
  addressLine: string | null
  city: string | null
  district: string | null
  ward: string | null
}

export function AccountLoginClient() {
  const [tab, setTab] = useState<'magic' | 'password' | 'signup'>('magic')
  const [magicState, magicAction, magicPending] = useActionState(signInWithMagicLink, INITIAL)
  const [passState, passAction, passPending] = useActionState(signInWithPassword, INITIAL)
  const [signState, signAction, signPending] = useActionState(signUpWithPassword, INITIAL)

  const active =
    tab === 'magic' ? magicState : tab === 'password' ? passState : signState

  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Tài khoản TechStore</p>
      <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">Đăng nhập</h1>
      <p className="mt-2 text-(length:--text-sm) text-fg-muted">
        Magic link email hoặc mật khẩu — đồng bộ hồ sơ & đơn hàng trên nhiều thiết bị qua Supabase
        Auth.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-1 rounded-(--radius-md) border border-border p-1">
        {(
          [
            ['magic', 'Magic link'],
            ['password', 'Mật khẩu'],
            ['signup', 'Đăng ký'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`min-h-10 rounded-(--radius-sm) text-(length:--text-xs) font-semibold sm:text-(length:--text-sm) ${
              tab === id ? 'bg-brand text-accent-fg' : 'text-fg-muted'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {active.message ? (
        <p
          role="status"
          className={`mt-4 rounded-(--radius-md) px-3 py-2 text-(length:--text-sm) ${
            active.ok ? 'bg-success-subtle text-fg' : 'bg-danger-subtle text-danger'
          }`}
        >
          {active.message}
        </p>
      ) : null}

      {tab === 'magic' ? (
        <form action={magicAction} className="mt-6 space-y-4">
          <Field label="Email" id="m-email">
            <input id="m-email" name="email" type="email" required className="field-input" autoComplete="email" />
          </Field>
          <button
            type="submit"
            disabled={magicPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
          >
            {magicPending ? 'Đang gửi…' : 'Gửi magic link'}
          </button>
        </form>
      ) : null}

      {tab === 'password' ? (
        <form action={passAction} className="mt-6 space-y-4">
          <Field label="Email" id="p-email">
            <input id="p-email" name="email" type="email" required className="field-input" autoComplete="email" />
          </Field>
          <Field label="Mật khẩu" id="p-pass">
            <input
              id="p-pass"
              name="password"
              type="password"
              required
              minLength={6}
              className="field-input"
              autoComplete="current-password"
            />
          </Field>
          <button
            type="submit"
            disabled={passPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
          >
            {passPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      ) : null}

      {tab === 'signup' ? (
        <form action={signAction} className="mt-6 space-y-4">
          <Field label="Họ và tên" id="s-name">
            <input id="s-name" name="fullName" className="field-input" autoComplete="name" />
          </Field>
          <Field label="Email" id="s-email">
            <input id="s-email" name="email" type="email" required className="field-input" autoComplete="email" />
          </Field>
          <Field label="Mật khẩu" id="s-pass">
            <input
              id="s-pass"
              name="password"
              type="password"
              required
              minLength={6}
              className="field-input"
              autoComplete="new-password"
            />
          </Field>
          <button
            type="submit"
            disabled={signPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
          >
            {signPending ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </form>
      ) : null}

      <p className="mt-6 text-(length:--text-xs) text-fg-subtle">
        Guest checkout vẫn hoạt động không cần đăng nhập. Bật Email provider trong Supabase Auth
        (magic link / password).
      </p>
      <p className="mt-2 text-(length:--text-xs) text-fg-subtle">
        <Link href="/products" className="font-semibold text-brand">
          Tiếp tục mua sắm →
        </Link>
      </p>
    </div>
  )
}

export function AccountDashboardClient({
  email,
  displayName,
  profile,
  orders,
  wishCount,
  compareCount,
}: {
  email: string
  displayName: string
  profile: ServerProfile | null
  orders: ServerOrder[]
  wishCount: number
  compareCount: number
}) {
  const { toast } = useOptionalToast()
  const [profileState, profileAction, profilePending] = useActionState(
    async (prev: AuthFormState, fd: FormData) => {
      const result = await saveServerProfile(prev, fd)
      if (result.ok) toast({ title: 'Đã lưu hồ sơ', description: result.message, tone: 'success' })
      else toast({ title: 'Lỗi', description: result.message, tone: 'error' })
      return result
    },
    INITIAL,
  )

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tài khoản</p>
          <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">{displayName}</h1>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">{email}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-11 rounded-(--radius-md) border border-border px-4 text-(length:--text-sm) font-medium hover:bg-surface-muted"
          >
            Đăng xuất
          </button>
        </form>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/wishlist" label="Wishlist (thiết bị)" value={String(wishCount)} />
        <StatCard href="/compare" label="So sánh" value={String(compareCount)} />
        <StatCard href="#orders" label="Đơn server" value={String(orders.length)} />
        <StatCard href="/cart" label="Giỏ hàng" value="→" />
      </ul>

      <section className="rounded-(--radius-xl) border border-border bg-bg-elevated p-6 shadow-(--shadow-sm)">
        <h2 className="text-(length:--text-lg) font-semibold">Hồ sơ (đồng bộ server)</h2>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          Prefill checkout và gắn đơn hàng khi bạn đăng nhập.
        </p>
        {profileState.message ? (
          <p className={`mt-3 text-(length:--text-sm) ${profileState.ok ? 'text-success' : 'text-danger'}`}>
            {profileState.message}
          </p>
        ) : null}
        <form action={profileAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên" id="p-name">
            <input
              id="p-name"
              name="fullName"
              defaultValue={profile?.fullName ?? ''}
              className="field-input"
            />
          </Field>
          <Field label="Số điện thoại" id="p-phone">
            <input id="p-phone" name="phone" defaultValue={profile?.phone ?? ''} className="field-input" />
          </Field>
          <Field label="Email" id="p-email">
            <input
              id="p-email"
              name="email"
              type="email"
              defaultValue={profile?.email ?? email}
              className="field-input"
            />
          </Field>
          <Field label="Phường / Xã" id="p-ward">
            <input id="p-ward" name="ward" defaultValue={profile?.ward ?? ''} className="field-input" />
          </Field>
          <Field label="Địa chỉ" id="p-address" className="sm:col-span-2">
            <input
              id="p-address"
              name="addressLine"
              defaultValue={profile?.addressLine ?? ''}
              className="field-input"
            />
          </Field>
          <Field label="Quận / Huyện" id="p-district">
            <input
              id="p-district"
              name="district"
              defaultValue={profile?.district ?? ''}
              className="field-input"
            />
          </Field>
          <Field label="Tỉnh / Thành" id="p-city">
            <input id="p-city" name="city" defaultValue={profile?.city ?? ''} className="field-input" />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={profilePending}
              className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
            >
              {profilePending ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </section>

      <section id="orders">
        <h2 className="text-(length:--text-lg) font-semibold">Đơn hàng của bạn</h2>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          Chỉ các đơn đặt khi đã đăng nhập (gắn user_id).
        </p>
        {orders.length === 0 ? (
          <div className="mt-4 rounded-(--radius-lg) border border-dashed border-border-strong px-5 py-10 text-center">
            <p className="font-semibold">Chưa có đơn trên tài khoản</p>
            <p className="mt-1 text-(length:--text-sm) text-fg-muted">
              Đặt hàng khi đã đăng nhập để xem lịch sử tại đây.
            </p>
            <Link href="/products" className="mt-4 inline-flex font-semibold text-brand">
              Mua sắm →
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-(--radius-lg) border border-border">
            {orders.map((o) => (
              <li key={o.orderCode} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold tabular-nums">{o.orderCode}</p>
                  <p className="text-(length:--text-xs) text-fg-muted">
                    {new Date(o.createdAt).toLocaleString('vi-VN')} · {o.itemCount} SP ·{' '}
                    {o.orderStatus} / {o.paymentStatus}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatPrice(o.total)}</span>
                  <Link href={`/orders/${o.orderCode}`} className="text-(length:--text-sm) font-semibold text-brand">
                    Chi tiết →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Field({
  label,
  id,
  children,
  className = '',
}: {
  label: string
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-(length:--text-sm) font-medium text-fg">
        {label}
      </label>
      {children}
    </div>
  )
}

function StatCard({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <li>
      <Link
        href={href}
        className="reveal-soft flex flex-col rounded-(--radius-lg) border border-border bg-bg-elevated p-4 shadow-(--shadow-sm)"
      >
        <span className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
          {label}
        </span>
        <span className="mt-2 text-(length:--text-2xl) font-semibold tabular-nums text-fg">{value}</span>
      </Link>
    </li>
  )
}

