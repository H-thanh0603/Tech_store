'use server'

import { requireAdminSession } from '@/lib/admin/auth'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export type UploadResult = {
  ok: boolean
  url?: string
  error?: string
}

export async function uploadProductImage(file: File): Promise<UploadResult> {
  const admin = await requireAdminSession('products')
  if (!('actorLabel' in admin)) {
    return { ok: false, error: 'Unauthorized' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Định dạng ảnh không hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP, GIF.' }
  }

  if (file.size > MAX_SIZE) {
    return { ok: false, error: 'Ảnh quá lớn. Tối đa 10MB.' }
  }

  const ext = file.name.split('.').pop() || 'webp'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `products/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const db = getSupabaseAdminClient()
  const { error } = await db.storage.from('product-images').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    console.error('[uploadProductImage]', error.message)
    return { ok: false, error: 'Upload ảnh thất bại. Vui lòng thử lại.' }
  }

  const { data: urlData } = db.storage.from('product-images').getPublicUrl(path)

  return { ok: true, url: urlData.publicUrl }
}

export async function deleteProductImage(path: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdminSession('products')
  if (!('actorLabel' in admin)) {
    return { ok: false, error: 'Unauthorized' }
  }

  const db = getSupabaseAdminClient()
  const { error } = await db.storage.from('product-images').remove([path])

  if (error) {
    console.error('[deleteProductImage]', error.message)
    return { ok: false, error: 'Xóa ảnh thất bại.' }
  }

  return { ok: true }
}
