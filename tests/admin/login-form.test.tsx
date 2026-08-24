// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin/auth-actions', () => ({
  adminLogin: vi.fn(async () => ({ ok: true })),
}))

import { AdminLoginForm } from '@/components/admin/login-form'

describe('AdminLoginForm', () => {
  it('renders account credentials for Supabase admin auth', () => {
    render(<AdminLoginForm />)

    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('name', 'email')
    expect(screen.getByLabelText(/^mật khẩu$/i)).toHaveAttribute('name', 'password')
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument()
  })
})
