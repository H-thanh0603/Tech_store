// k6 browse scenario: category listing under load.
// Run: k6 run k6/browse.js  (override BASE_URL for staging/prod)
// Audit target (§22): 100 VU / 5m on /products — watch p95 + Supabase CPU.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:3000'
const p95 = new Trend('browse_p95')

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<1500'] },
}

const PAGES = ['/products', '/products?page=2', '/products?sort=price-asc', '/']

export default function () {
  const path = PAGES[Math.floor(Math.random() * PAGES.length)]
  const res = http.get(`${BASE_URL}${path}`)
  check(res, { 'status 200': (r) => r.status === 200 })
  p95.add(res.timings.duration)
  sleep(1)
}
