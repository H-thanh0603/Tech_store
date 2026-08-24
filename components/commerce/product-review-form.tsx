'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { submitProductReview, type ReviewActionState } from '@/lib/customer/review-actions'

const initial: ReviewActionState = { ok: false }

export function ProductReviewForm({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(submitProductReview, initial)

  if (!signedIn) {
    return <p className="rounded-(--radius-lg) border border-border bg-surface-muted p-4 text-sm text-fg-muted"><Link href="/account/login" className="font-semibold text-brand">Đăng nhập</Link> bằng tài khoản đã mua sản phẩm để viết đánh giá.</p>
  }

  return <form action={action} className="space-y-3 rounded-(--radius-lg) border border-border bg-surface-raised p-4">
    <input type="hidden" name="productId" value={productId} />
    <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
      <label className="text-sm font-medium">Số sao<select name="rating" defaultValue="5" className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-elevated px-3"><option value="5">5 sao</option><option value="4">4 sao</option><option value="3">3 sao</option><option value="2">2 sao</option><option value="1">1 sao</option></select></label>
      <label className="text-sm font-medium">Tiêu đề<input name="title" maxLength={120} className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-elevated px-3" placeholder="Tóm tắt trải nghiệm" /></label>
    </div>
    <label className="block text-sm font-medium">Nhận xét<textarea name="body" required minLength={1} maxLength={2000} rows={4} className="mt-1 w-full rounded-(--radius-md) border border-border bg-bg-elevated p-3" /></label>
    {state.message ? <p role="status" className={`text-sm ${state.ok ? 'text-success' : 'text-danger'}`}>{state.message}</p> : null}
    <button disabled={pending} className="min-h-11 rounded-(--radius-md) bg-brand px-4 text-sm font-semibold text-accent-fg">{pending ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
  </form>
}
