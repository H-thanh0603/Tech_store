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
}

export function getGhnConfig(): GhnConfig | null {
  const token = process.env.GHN_TOKEN
  const shopId = process.env.GHN_SHOP_ID
  if (!token || !shopId) return null
  return {
    token,
    shopId,
    apiBase: process.env.GHN_API_BASE ?? 'https://online-gateway.ghn.vn/shiip/public-api',
  }
}

function mockFee(request: ShippingQuoteRequest): number {
  const items = Math.max(1, Math.floor(request.itemCount))
  return 22000 + 4000 * (items - 1)
}

export async function quoteGhn(request: ShippingQuoteRequest): Promise<ShippingQuote> {
  const config = getGhnConfig()
  if (!config) {
    return {
      carrier: 'ghn',
      service: 'GHN tiêu chuẩn (demo)',
      fee: mockFee(request),
      etaDays: 3,
      isMock: true,
    }
  }
  // Live call intentionally not wired until the shop provides district/ward
  // code mapping + parcel dimensions. Fail closed to the internal table
  // rather than charging a guessed fee.
  throw new Error('GHN live quote chưa được cấu hình mapping mã địa chỉ — dùng bảng internal.')
}

export async function trackGhn(trackingCode: string): Promise<ShipmentTracking> {
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
  throw new Error('GHN live tracking chưa được cấu hình — thêm GHN_TOKEN/GHN_SHOP_ID và mapping trước.')
}
