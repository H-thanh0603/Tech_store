export type CarrierName = 'ghn' | 'ghtk' | 'internal'

export interface ShippingQuoteRequest {
  province: string
  district: string
  ward: string
  /** Total parcel weight in grams. Defaults to 500g per item when unknown. */
  weightGrams?: number
  subtotal: number
  itemCount: number
}

export interface ShippingQuote {
  carrier: CarrierName
  service: string
  /** Fee in VND. */
  fee: number
  /** Estimated transit days. */
  etaDays: number
  /** True when no carrier key is configured and values are placeholders. */
  isMock: boolean
}

export interface TrackingEvent {
  at: string
  status: string
  description: string
}

export interface ShipmentTracking {
  carrier: CarrierName
  trackingCode: string
  status: string
  events: TrackingEvent[]
  isMock: boolean
}
