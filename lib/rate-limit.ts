import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

// Global rate limiter for order tracking (5 requests per minute per IP)
export const trackingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/tracking',
})

// Harder rate limiter for checkout/order placement (2 requests per minute per IP)
export const checkoutRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/checkout',
})
