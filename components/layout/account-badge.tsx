'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { IconUser } from '@/components/ui/icons'

interface MeResponse {
  user: { email: string | null; fullName: string | null } | null
}

/**
 * Client account badge. Fetches identity on mount so the server layout
 * does not need the auth cookie, which keeps catalog pages
 * ISR-cacheable. Shows the neutral "Đăng nhập" state until hydration.
 */
export function AccountBadge() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: MeResponse) => {
        if (!active) return
        if (!data.user) return // keep default "Đăng nhập"
        setLabel(
          data.user.fullName ||
            (data.user.email ? data.user.email.split('@')[0] : null),
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <Link
      href={label ? '/account' : '/account/login'}
      className="hidden min-h-11 items-center gap-1.5 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg sm:inline-flex"
      aria-label={label ? `Tài khoản ${label}` : 'Đăng nhập'}
    >
      <IconUser size={18} />
      <span className="hidden max-w-24 truncate lg:inline">{label ?? 'Đăng nhập'}</span>
    </Link>
  )
}
