// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin/auth-actions', () => ({
  adminLogin: vi.fn(async () => ({ ok: true })),
}))

import { AdminLoginForm } from '@/components/admin/login-form'

describe('AdminLoginForm', () => {
  it('renders password field and submit button', () => {
    render(<AdminLoginForm />)
    expect(screen.getByLabelText(/mật khẩu admin/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument()
  })
})
