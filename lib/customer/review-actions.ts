'use server'

import { revalidatePath } from 'next/cache'

import { productReviewSchema } from '@/lib/customer/review-validation'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export type ReviewActionState = { ok: boolean; message?: string }

export async function submitProductReview(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const parsed = productReviewSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: 'Đánh giá chưa hợp lệ.' }

  const supabase = await createSupabaseAuthClient()
  const { data, error } = await supabase.rpc('customer_submit_product_review', {
    p_product_id: parsed.data.productId,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title ?? null,
    p_body: parsed.data.body,
  })
  if (error) return { ok: false, message: 'Không gửi được đánh giá.' }

  const code = (data as { code?: string } | null)?.code
  if (code === 'UNAUTHORIZED') return { ok: false, message: 'Bạn cần đăng nhập.' }
  if (code === 'NOT_PURCHASED') return { ok: false, message: 'Chỉ khách đã mua sản phẩm này mới được đánh giá.' }
  if (code === 'ALREADY_REVIEWED') return { ok: false, message: 'Bạn đã đánh giá sản phẩm này.' }
  if (code !== 'OK') return { ok: false, message: 'Không gửi được đánh giá.' }

  revalidatePath('/products', 'layout')
  return { ok: true, message: 'Đã gửi đánh giá.' }
}
