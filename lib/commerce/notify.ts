import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getSiteUrl } from '@/lib/site'

// Notification outbox drain. Sends pending rows via Resend REST (no SDK).
// Without RESEND_API_KEY rows stay pending — checkout never blocks on email.

interface OutboxRow {
  id: string
  type: string
  payload: Record<string, unknown>
  retry_count: number
}

const MAX_RETRIES = 5

function formatVnd(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('vi-VN') + '₫' : ''
}

function emailFor(type: string, payload: Record<string, unknown>): {
  subject: string
  html: string
} | null {
  const site = getSiteUrl()
  const name = String(payload.customerName ?? 'bạn')
  switch (type) {
    case 'order_confirmation': {
      const code = String(payload.orderCode ?? '')
      return {
        subject: `Xác nhận đơn hàng ${code} — TechStore`,
        html:
          `<p>Chào ${name},</p>` +
          `<p>Đơn hàng <strong>${code}</strong> đã được ghi nhận với tổng tiền ` +
          `<strong>${formatVnd(payload.total)}</strong>.</p>` +
          `<p>Tra cứu đơn: <a href="${site}/track-order">${site}/track-order</a></p>` +
          `<p>Cảm ơn bạn đã mua sắm tại TechStore.</p>`,
      }
    }
    case 'order_transfer_paid': {
      const code = String(payload.orderCode ?? '')
      return {
        subject: `Đã nhận thanh toán đơn ${code} — TechStore`,
        html:
          `<p>Chào ${name},</p>` +
          `<p>TechStore đã nhận thanh toán <strong>${formatVnd(payload.total)}</strong> ` +
          `cho đơn <strong>${code}</strong>. Đơn sẽ được xử lý và giao sớm nhất.</p>`,
      }
    }
    case 'restock_alert':
      return {
        subject: 'Sản phẩm bạn quan tâm đã có hàng — TechStore',
        html:
          `<p>Chào bạn,</p>` +
          `<p>Sản phẩm bạn đăng ký nhận thông báo đã có hàng trở lại.</p>` +
          `<p><a href="${site}/products">Xem ngay tại TechStore</a></p>`,
      }
    case 'review_request': {
      const code = String(payload.orderCode ?? '')
      return {
        subject: `Bạn thấy đơn ${code} thế nào? — TechStore`,
        html:
          `<p>Chào ${name},</p>` +
          `<p>Đơn <strong>${code}</strong> đã hoàn tất. Nếu hài lòng, hãy để lại đánh giá ` +
          `giúp khách hàng khác nhé.</p>`,
      }
    }
    default:
      return null
  }
}

export async function processPendingNotifications(batchSize = 20): Promise<{
  sent: number
  failed: number
  skipped: number
}> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? 'TechStore <onboarding@resend.dev>'
  const admin = getSupabaseAdminClient()

  const { data: rows } = await admin
    .from('notification_outbox')
    .select('id, type, payload, retry_count')
    .eq('status', 'pending')
    .or('next_retry_at.is.null,next_retry_at.lte.now()')
    .order('queued_at', { ascending: true })
    .limit(batchSize)

  const result = { sent: 0, failed: 0, skipped: 0 }
  for (const row of (rows ?? []) as unknown as OutboxRow[]) {
    const email = emailFor(row.type, row.payload)
    const to = String(row.payload.email ?? '')
    if (!email || !to) {
      await admin.from('notification_outbox').update({ status: 'skipped' }).eq('id', row.id)
      result.skipped += 1
      continue
    }
    if (!apiKey) {
      // No key configured: leave pending, stop here — nothing can be sent.
      break
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject: email.subject, html: email.html }),
      })
      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${await response.text()}`)
      }
      await admin
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', row.id)
      result.sent += 1
    } catch (error) {
      const retries = row.retry_count + 1
      const exhausted = retries >= MAX_RETRIES
      // Exponential backoff: 1m, 2m, 4m, 8m, 16m.
      const backoffMs = 60_000 * 2 ** row.retry_count
      await admin
        .from('notification_outbox')
        .update({
          status: exhausted ? 'failed' : 'pending',
          retry_count: retries,
          error: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
          next_retry_at: exhausted
            ? null
            : new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq('id', row.id)
      result.failed += 1
    }
  }
  return result
}
