import type {
  ShipmentTracking,
  ShippingQuote,
  ShippingQuoteRequest,
} from '@/lib/shipping/types'

// GHN adapter skeleton. Env-gated like VNPay: without GHN_TOKEN the
// checkout keeps the internal rate table and these functions return
// clearly-marked mock values so UI/tracking flows are testable before
// the shop signs a GHN contract.
// Docs: https://api.ghn.vn/home/docs/detail?id=41

export interface GhnConfig {
  token: string
  shopId: string
  apiBase: string
  /** GHN district id of the sender warehouse — required for live fee quotes. */
  fromDistrictId: number | null
  /** GHN ward code of the sender — required for live fee quotes. */
  fromWardCode: string | null
  /** Default service_id (53320 = standard). Override per-parcel later. */
  serviceId: number
}

export function getGhnConfig(): GhnConfig | null {
  const token = process.env.GHN_TOKEN
  const shopId = process.env.GHN_SHOP_ID
  if (!token || !shopId) return null
  const fromDistrict = Number(process.env.GHN_FROM_DISTRICT_ID ?? '')
  const fromWard = (process.env.GHN_FROM_WARD_CODE ?? '').trim() || null
  return {
    token,
    shopId,
    apiBase: process.env.GHN_API_BASE ?? 'https://online-gateway.ghn.vn/shiip/public-api',
    fromDistrictId: Number.isFinite(fromDistrict) && fromDistrict > 0 ? fromDistrict : null,
    fromWardCode: fromWard,
    serviceId: Number(process.env.GHN_SERVICE_ID ?? 53320) || 53320,
  }
}

function mockFee(request: ShippingQuoteRequest): number {
  const items = Math.max(1, Math.floor(request.itemCount))
  return 22000 + 4000 * (items - 1)
}

function mockQuote(request: ShippingQuoteRequest): ShippingQuote {
  return {
    carrier: 'ghn',
    service: 'GHN tiêu chuẩn (demo)',
    fee: mockFee(request),
    etaDays: 3,
    isMock: true,
  }
}

export interface GhnAddressCodes {
  toDistrictId: number
  toWardCode: string
}

/**
 * Resolve the free-text district/ward from checkout to GHN numeric codes.
 * The caller supplies a resolver (DB table or GHN master-data cache); the
 * adapter never guesses codes. Without a resolver → mock quote.
 */
export async function quoteGhn(
  request: ShippingQuoteRequest,
  resolveCodes?: (request: ShippingQuoteRequest) => Promise<GhnAddressCodes | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<ShippingQuote> {
  const config = getGhnConfig()
  if (!config) return mockQuote(request)
  if (!config.fromDistrictId || !config.fromWardCode || !resolveCodes) {
    // Missing sender codes or no resolver: fail closed to the clearly-marked
    // mock instead of charging a guessed fee. Set GHN_FROM_DISTRICT_ID +
    // GHN_FROM_WARD_CODE and pass a resolver to go live.
    return mockQuote(request)
  }
  const dest = await resolveCodes(request)
  if (!dest) return mockQuote(request)
  const weight = Math.max(100, request.weightGrams ?? request.itemCount * 500)
  const body = {
    service_id: config.serviceId,
    insurance_value: Math.max(0, Math.floor(request.subtotal)),
    from_district_id: config.fromDistrictId,
    to_district_id: dest.toDistrictId,
    to_ward_code: dest.toWardCode,
    height: 10,
    length: 20,
    weight,
    width: 15,
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(`${config.apiBase}/v2/shipping-order/fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: config.token, ShopId: config.shopId },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const parsed = (await response.json()) as {
      code?: number
      message?: string
      data?: { total?: number; service_fee?: number; expected_delivery_time?: string }
    }
    if (!response.ok || parsed.code !== 200 || typeof parsed.data?.total !== 'number') {
      throw new Error(`GHN báo phí thất bại (${parsed.code ?? response.status}): ${parsed.message ?? 'unknown'}`)
    }
    const eta = parsed.data.expected_delivery_time
      ? Math.max(1, Math.round((new Date(parsed.data.expected_delivery_time).getTime() - Date.now()) / 86_400_000))
      : 3
    return {
      carrier: 'ghn',
      service: 'GHN tiêu chuẩn',
      fee: Math.round(parsed.data.total),
      etaDays: eta,
      isMock: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function trackGhn(
  trackingCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ShipmentTracking> {
  const code = trackingCode.trim()
  if (!code) throw new Error('Mã vận đơn trống.')
  const config = getGhnConfig()
  if (!config) {
    const now = new Date().toISOString()
    return {
      carrier: 'ghn',
      trackingCode: code,
      status: 'mock',
      isMock: true,
      events: [
        { at: now, status: 'created', description: 'Đã tạo vận đơn (dữ liệu demo, chưa nối GHN).' },
      ],
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(`${config.apiBase}/v2/shipping-order/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: config.token, ShopId: config.shopId },
      body: JSON.stringify({ order_code: code }),
      signal: controller.signal,
    })
    const parsed = (await response.json()) as {
      code?: number
      message?: string
      data?: { status?: string; log?: Array<{ updated_date?: string; status?: string; trip_code?: string }> }
    }
    if (!response.ok || parsed.code !== 200 || !parsed.data) {
      throw new Error(`GHN tra cứu thất bại (${parsed.code ?? response.status}): ${parsed.message ?? 'unknown'}`)
    }
    return {
      carrier: 'ghn',
      trackingCode: code,
      status: parsed.data.status ?? 'unknown',
      isMock: false,
      events: (parsed.data.log ?? []).map((entry) => ({
        at: entry.updated_date ?? new Date().toISOString(),
        status: entry.status ?? 'update',
        description: entry.trip_code ? `Chuyến ${entry.trip_code}` : (entry.status ?? 'Cập nhật'),
      })),
    }
  } finally {
    clearTimeout(timeout)
  }
}
