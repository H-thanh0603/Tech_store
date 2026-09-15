'use server'

import { requireAdminSession } from '@/lib/admin/auth'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

async function writeImageAudit(
  action: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof requireAdminSession>>,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: 'product_image',
      entity_id: entityId,
      payload,
      actor_label: actor.actorLabel,
      actor_user_id: actor.userId,
    })
  } catch {
    // Audit must never block business action
  }
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * M2: verify magic bytes server-side — the client-supplied MIME (file.type)
 * is attacker-controlled and trivially forged (e.g. SVG/HTML labeled
 * image/png). Only buffers whose leading bytes match the claimed image
 * format are accepted.
 */
export function magicMatches(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const jpeg = [0xff, 0xd8, 0xff]
  const gif87 = 'GIF87a'
  const gif89 = 'GIF89a'
  switch (mime) {
    case 'image/png':
      return png.every((b, i) => buffer[i] === b)
    case 'image/jpeg':
      return jpeg.every((b, i) => buffer[i] === b)
    case 'image/gif':
      return buffer.toString('ascii', 0, 6) === gif87 || buffer.toString('ascii', 0, 6) === gif89
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    default:
      return false
  }
}

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

  const extFromType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const ext = extFromType[file.type] || file.name.split('.').pop() || 'webp'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `products/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())

  if (!magicMatches(buffer, file.type)) {
    return { ok: false, error: 'File không phải ảnh hợp lệ (định dạng không khớp nội dung).' }
  }

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

  await writeImageAudit('image_upload', null, { path, url: urlData.publicUrl, type: file.type, size: file.size }, admin)

  return { ok: true, url: urlData.publicUrl }
}

export async function deleteProductImage(path: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdminSession('products')
  if (!('actorLabel' in admin)) {
    return { ok: false, error: 'Unauthorized' }
  }

  // Validate storage path to prevent arbitrary deletion (SEC-008)
  if (!/^products\/[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$/.test(path) || path.includes('..')) {
    return { ok: false, error: 'Đường dẫn không hợp lệ.' }
  }

  const db = getSupabaseAdminClient()
  const { error } = await db.storage.from('product-images').remove([path])

  if (error) {
    console.error('[deleteProductImage]', error.message)
    return { ok: false, error: 'Xóa ảnh thất bại.' }
  }

  await writeImageAudit('image_delete', null, { path }, admin)

  return { ok: true }
}
