import type {
  ShipmentTracking,
  ShippingQuote,
  ShippingQuoteRequest,
} from '@/lib/shipping/types'

// GHTK adapter skeleton. Same env-gated mock pattern as GHN.
// Docs: https://giaohangtietkiem.vn/api/

export interface GhtkConfig {
  token: string
  apiBase: string
  /** Sender province/district names for the live fee estimator. */
  pickProvince: string | null
  pickDistrict: string | null
}

export function getGhtkConfig(): GhtkConfig | null {
  const token = process.env.GHTK_TOKEN
  if (!token) return null
  return {
    token,
    apiBase: process.env.GHTK_API_BASE ?? 'https://services.giaohangtietkiem.vn/services/shipment',
    pickProvince: (process.env.GHTK_PICK_PROVINCE ?? '').trim() || null,
    pickDistrict: (process.env.GHTK_PICK_DISTRICT ?? '').trim() || null,
  }
}

function mockFee(request: ShippingQuoteRequest): number {
  const items = Math.max(1, Math.floor(request.itemCount))
  return 20000 + 3500 * (items - 1)
}

function mockQuote(request: ShippingQuoteRequest): ShippingQuote {
  return {
    carrier: 'ghtk',
    service: 'GHTK tiêu chuẩn (demo)',
    fee: mockFee(request),
    etaDays: 3,
    isMock: true,
  }
}

export async function quoteGhtk(
  request: ShippingQuoteRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ShippingQuote> {
  const config = getGhtkConfig()
  if (!config) return mockQuote(request)
  if (!config.pickProvince || !config.pickDistrict) return mockQuote(request)
  // GHTK fee is a GET with address names (no numeric codes needed) — the only
  // extra config is the sender province/district above.
  const weight = Math.max(0.1, (request.weightGrams ?? request.itemCount * 500) / 1000)
  const query = new URLSearchParams({
    pick_province: config.pickProvince,
    pick_district: config.pickDistrict,
    province: request.province,
    district: request.district,
    address: request.ward || request.district,
    weight: String(weight),
    value: String(Math.max(0, Math.floor(request.subtotal))),
    transport: 'road',
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(`${config.apiBase}/fee?${query}`, {
      headers: { Token: config.token },
      signal: controller.signal,
    })
    const parsed = (await response.json()) as {
      success?: boolean
      message?: string
      fee?: { fee?: number; delivery?: boolean }
    }
    if (!response.ok || parsed.success !== true || typeof parsed.fee?.fee !== 'number') {
      throw new Error(`GHTK báo phí thất bại: ${parsed.message ?? response.status}`)
    }
    return {
      carrier: 'ghtk',
      service: 'GHTK tiêu chuẩn',
      fee: Math.round(parsed.fee.fee),
      etaDays: 3,
      isMock: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function trackGhtk(
  trackingCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ShipmentTracking> {
  const code = trackingCode.trim()
  if (!code) throw new Error('Mã vận đơn trống.')
  const config = getGhtkConfig()
  if (!config) {
    const now = new Date().toISOString()
    return {
      carrier: 'ghtk',
      trackingCode: code,
      status: 'mock',
      isMock: true,
      events: [
        { at: now, status: 'created', description: 'Đã tạo vận đơn (dữ liệu demo, chưa nối GHTK).' },
      ],
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(`${config.apiBase}/v2/${encodeURIComponent(code)}`, {
      headers: { Token: config.token },
      signal: controller.signal,
    })
    const parsed = (await response.json()) as {
      success?: boolean
      message?: string
      order?: { status_text?: string; status_id?: number; message?: string; modified?: string }
    }
    if (!response.ok || parsed.success !== true || !parsed.order) {
      throw new Error(`GHTK tra cứu thất bại: ${parsed.message ?? response.status}`)
    }
    return {
      carrier: 'ghtk',
      trackingCode: code,
      status: parsed.order.status_text ?? String(parsed.order.status_id ?? 'unknown'),
      isMock: false,
      events: [{
        at: parsed.order.modified ?? new Date().toISOString(),
        status: parsed.order.status_text ?? 'update',
        description: parsed.order.message ?? parsed.order.status_text ?? 'Cập nhật',
      }],
    }
  } finally {
    clearTimeout(timeout)
  }
}
