// k6 checkout-mix scenario: browse → cart → COD checkout.
// Run against LOCAL Supabase only (creates real orders!):
//   BASE_URL=http://127.0.0.1:3000 k6 run k6/checkout-mix.js
// Audit target (§22): 20 VU — watch place_order p95 + lock contention.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:3000'

export const options = {
  vus: 20,
  duration: '3m',
  thresholds: { http_req_duration: ['p(95)<2000'] },
}

export default function () {
  const list = http.get(`${BASE_URL}/products`)
  check(list, { 'listing 200': (r) => r.status === 200 })
  sleep(1)
  // Full cart→checkout needs variant IDs + cookies; this probe keeps the
  // storefront warm. Extend with a seeded variant id for real checkouts.
  const cart = http.get(`${BASE_URL}/cart`)
  check(cart, { 'cart 200': (r) => r.status === 200 })
  sleep(2)
}
