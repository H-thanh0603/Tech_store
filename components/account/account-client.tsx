'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore, type FormEvent } from 'react'

import { useToast } from '@/components/ui/toast'
import {
  getProfile,
  getSavedOrders,
  getSession,
  loginLocal,
  logoutLocal,
  saveProfile,
  subscribeCustomer,
  type CustomerProfile,
} from '@/lib/customer/profile'
import {
  getCompareSnapshot,
  getServerListSnapshot,
  getWishlistSnapshot,
  subscribeLists,
} from '@/lib/customer/local-lists'

function useCustomerSession() {
  return useSyncExternalStore(subscribeCustomer, getSession, () => null)
}

function useCustomerProfile(): CustomerProfile {
  return useSyncExternalStore(subscribeCustomer, getProfile, getProfile)
}

function useSavedOrders() {
  return useSyncExternalStore(subscribeCustomer, getSavedOrders, getSavedOrders)
}

export function AccountLoginClient() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Email không hợp lệ')
      return
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('Nhập họ tên (tối thiểu 2 ký tự)')
      return
    }
    const session = loginLocal(cleanEmail, mode === 'register' ? name : name || cleanEmail.split('@')[0]!)
    if (mode === 'register') {
      saveProfile({ fullName: name.trim(), email: cleanEmail, phone: phone.trim() })
    }
    toast({
      title: mode === 'register' ? 'Đăng ký thành công' : 'Đã đăng nhập',
      description: `Xin chào ${session.displayName}`,
      tone: 'success',
    })
    router.push('/account')
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Tài khoản</p>
      <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">
        {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
      </h1>
      <p className="mt-2 text-(length:--text-sm) text-fg-muted">
        Lưu hồ sơ trên thiết bị để điền checkout nhanh. Vẫn mua guest không cần đăng nhập.
      </p>

      <div className="mt-6 flex rounded-(--radius-md) border border-border p-1">
        <button
          type="button"
          className={`min-h-10 flex-1 rounded-(--radius-sm) text-(length:--text-sm) font-semibold ${
            mode === 'login' ? 'bg-brand text-accent-fg' : 'text-fg-muted'
          }`}
          onClick={() => setMode('login')}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          className={`min-h-10 flex-1 rounded-(--radius-sm) text-(length:--text-sm) font-semibold ${
            mode === 'register' ? 'bg-brand text-accent-fg' : 'text-fg-muted'
          }`}
          onClick={() => setMode('register')}
        >
          Đăng ký
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'register' ? (
          <Field label="Họ và tên" id="acc-name">
            <input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              autoComplete="name"
              required
            />
          </Field>
        ) : null}
        <Field label="Email" id="acc-email">
          <input
            id="acc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            autoComplete="email"
            required
          />
        </Field>
        {mode === 'register' ? (
          <Field label="Số điện thoại (tuỳ chọn)" id="acc-phone">
            <input
              id="acc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field-input"
              autoComplete="tel"
              inputMode="tel"
            />
          </Field>
        ) : (
          <Field label="Tên hiển thị (tuỳ chọn)" id="acc-display">
            <input
              id="acc-display"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              autoComplete="nickname"
              placeholder="Để trống dùng phần trước @email"
            />
          </Field>
        )}
        {error ? (
          <p className="text-(length:--text-sm) text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
        >
          {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
      </form>

      <p className="mt-4 text-(length:--text-xs) text-fg-subtle">
        Demo local session — dữ liệu lưu trên trình duyệt của bạn, không đồng bộ server. Guest
        checkout vẫn hoạt động đầy đủ.
      </p>
    </div>
  )
}

export function AccountDashboardClient() {
  const router = useRouter()
  const { toast } = useToast()
  const session = useCustomerSession()
  const profile = useCustomerProfile()
  const orders = useSavedOrders()
  const wishlist = useSyncExternalStore(subscribeLists, getWishlistSnapshot, getServerListSnapshot)
  const compare = useSyncExternalStore(subscribeLists, getCompareSnapshot, getServerListSnapshot)
  const listCounts = { wish: wishlist.length, compare: compare.length }
  const [profileKey, setProfileKey] = useState(0)

  function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    saveProfile({
      fullName: String(fd.get('fullName') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      email: String(fd.get('email') ?? ''),
      addressLine: String(fd.get('addressLine') ?? ''),
      city: String(fd.get('city') ?? ''),
      district: String(fd.get('district') ?? ''),
    })
    setProfileKey((k) => k + 1)
    toast({ title: 'Đã lưu hồ sơ', description: 'Thông tin dùng để điền checkout nhanh.', tone: 'success' })
  }

  function onLogout() {
    logoutLocal()
    toast({ title: 'Đã đăng xuất', tone: 'info' })
    router.push('/account/login')
  }

  if (!session) {
    return (
      <div className="rounded-(--radius-xl) border border-dashed border-border-strong px-6 py-12 text-center">
        <p className="font-semibold">Bạn chưa đăng nhập</p>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          Đăng nhập để quản lý hồ sơ, hoặc tiếp tục mua guest.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/account/login"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-brand px-5 text-(length:--text-sm) font-semibold text-accent-fg"
          >
            Đăng nhập
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border px-5 text-(length:--text-sm) font-semibold"
          >
            Mua sắm
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Xin chào</p>
          <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">
            {session.displayName}
          </h1>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">{session.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-11 rounded-(--radius-md) border border-border px-4 text-(length:--text-sm) font-medium hover:bg-surface-muted"
        >
          Đăng xuất
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/wishlist" label="Wishlist" value={String(listCounts.wish)} />
        <StatCard href="/compare" label="So sánh" value={String(listCounts.compare)} />
        <StatCard href="/track-order" label="Đơn đã lưu" value={String(orders.length)} />
        <StatCard href="/cart" label="Giỏ hàng" value="→" />
      </ul>

      <section className="rounded-(--radius-xl) border border-border bg-bg-elevated p-6 shadow-(--shadow-sm)">
        <h2 className="text-(length:--text-lg) font-semibold">Thông tin khách hàng</h2>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          Dùng để prefill form checkout trên thiết bị này.
        </p>
        <form key={profileKey} onSubmit={onSaveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên" id="p-name">
            <input id="p-name" name="fullName" defaultValue={profile.fullName} className="field-input" />
          </Field>
          <Field label="Số điện thoại" id="p-phone">
            <input id="p-phone" name="phone" defaultValue={profile.phone} className="field-input" />
          </Field>
          <Field label="Email" id="p-email">
            <input id="p-email" name="email" type="email" defaultValue={profile.email} className="field-input" />
          </Field>
          <Field label="Quận / Huyện" id="p-district">
            <input id="p-district" name="district" defaultValue={profile.district} className="field-input" />
          </Field>
          <Field label="Địa chỉ" id="p-address" className="sm:col-span-2">
            <input id="p-address" name="addressLine" defaultValue={profile.addressLine} className="field-input" />
          </Field>
          <Field label="Tỉnh / Thành" id="p-city">
            <input id="p-city" name="city" defaultValue={profile.city} className="field-input" />
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover sm:w-auto"
            >
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-(length:--text-lg) font-semibold">Đơn hàng gần đây</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-(length:--text-sm) text-fg-muted">
            Chưa có mã đơn lưu trên thiết bị.{' '}
            <Link href="/track-order" className="font-semibold text-brand">
              Tra cứu đơn
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-(--radius-lg) border border-border">
            {orders.map((o) => (
              <li key={o.code} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold tabular-nums">{o.code}</p>
                  <p className="text-(length:--text-xs) text-fg-muted">
                    {new Date(o.savedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <Link
                  href={`/orders/${o.code}`}
                  className="text-(length:--text-sm) font-semibold text-brand"
                >
                  Xem →
                </Link>
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
