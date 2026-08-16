'use server'

import { redirect } from 'next/navigation'

import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

// GDPR erasure: unlink the user from orders/reviews, delete profile and
// restock waitlist rows, then sign out. Financial rows stay for tax/warranty
// records but carry no user reference.
export async function deleteMyDataAction(): Promise<never> {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/account/login')
  }

  const { data, error } = await supabase.rpc('customer_delete_my_data')
  const result = data as { code?: string } | null
  if (error || result?.code !== 'OK') {
    throw new Error('Không xóa được dữ liệu. Vui lòng thử lại.')
  }

  await supabase.auth.signOut()
  redirect('/')
}
