'use client'

import { useActionState } from 'react'

import { adminLogin } from '@/lib/admin/auth-actions'
import type { AdminActionState } from '@/lib/admin/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const initial: AdminActionState = { ok: true }

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, initial)

  return (
    <form action={action} className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Input
        id="admin-email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />
      <Input
        id="admin-password"
        name="password"
        type="password"
        label="Mật khẩu"
        autoComplete="current-password"
        required
        error={!state.ok && state.code === 'UNAUTHORIZED' ? state.message : undefined}
      />
      {!state.ok && state.code !== 'UNAUTHORIZED' ? (
        <p className="text-(length:--text-sm) text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
