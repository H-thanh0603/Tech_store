// k6 suggest scenario: per-keystroke autocomplete storm.
// Run: k6 run k6/suggest.js
// Audit target (§22): 200 VU random queries — watch count:'exact' cost.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:3000'

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<800'] },
}

const QUERIES = ['lap', 'phone', 'mac', 'dell', 'tai nghe', 's24', 'air']

export default function () {
  const q = encodeURIComponent(QUERIES[Math.floor(Math.random() * QUERIES.length)])
  const res = http.get(`${BASE_URL}/api/catalog/suggest?q=${q}`)
  check(res, { 'status 200/429': (r) => r.status === 200 || r.status === 429 })
  sleep(0.5)
}
