import { describe, expect, it } from 'vitest'

import { friendlyAuthError } from '@/lib/customer/auth-messages'

describe('friendlyAuthError', () => {
  it('translates the built-in email rate-limit cap', () => {
    expect(friendlyAuthError('email rate limit exceeded')).toContain('quá tải')
    expect(friendlyAuthError('over_email_send_rate_limit')).toContain('quá tải')
  })

  it('keeps the signups-disabled hint', () => {
    expect(friendlyAuthError('signups not allowed')).toContain('Đăng ký email chưa bật')
  })

  it('explains unauthorized recipient addresses', () => {
    expect(friendlyAuthError('Email address not authorized')).toContain('thành viên team')
  })

  it('passes unknown messages through untouched', () => {
    expect(friendlyAuthError('something else')).toBe('something else')
  })
})
