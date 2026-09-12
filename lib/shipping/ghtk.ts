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
}

export function getGhtkConfig(): GhtkConfig | null {
  const token = process.env.GHTK_TOKEN
  if (!token) return null
  return {
    token,
    apiBase: process.env.GHTK_API_BASE ?? 'https://services.giaohangtietkiem.vn/services/shipment',
  }
}

function mockFee(request: ShippingQuoteRequest): number {
  const items = Math.max(1, Math.floor(request.itemCount))
  return 20000 + 3500 * (items - 1)
}

export async function quoteGhtk(request: ShippingQuoteRequest): Promise<ShippingQuote> {
  const config = getGhtkConfig()
  if (!config) {
    return {
      carrier: 'ghtk',
      service: 'GHTK tiêu chuẩn (demo)',
      fee: mockFee(request),
      etaDays: 3,
      isMock: true,
    }
  }
  throw new Error('GHTK live quote chưa được cấu hình mapping địa chỉ — dùng bảng internal.')
}

export async function trackGhtk(trackingCode: string): Promise<ShipmentTracking> {
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
  throw new Error('GHTK live tracking chưa được cấu hình — thêm GHTK_TOKEN và mapping trước.')
}
