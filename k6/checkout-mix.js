// k6 checkout-mix: browse → cart → place_order contention.
// Chế độ 1 (mặc định): warm GET /products + /cart, p95<2000ms.
// Chế độ 2 (contention thật): đặt SEED_VARIANT_ID + SUPABASE_URL + SUPABASE_ANON_KEY
//   SEED_VARIANT_ID=<uuid> SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> k6 run k6/checkout-mix.js
// Khi đó mỗi VU: cart_add_item → place_order(COD) qua PostgREST, đo lock contention
// của place_order_internal (ORDER BY variant_id FOR UPDATE). Chỉ chạy LOCAL.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:3000'
const SUPABASE_URL = __ENV.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY ?? ''
const SEED_VARIANT_ID = __ENV.SEED_VARIANT_ID ?? ''

export const options = {
  vus: 20,
  duration: '3m',
  thresholds: { http_req_duration: ['p(95)<2000'] },
}

function warmBrowse() {
  const list = http.get(`${BASE_URL}/products`)
  check(list, { 'listing 200': (r) => r.status === 200 })
  sleep(1)
  const cart = http.get(`${BASE_URL}/cart`)
  check(cart, { 'cart 200': (r) => r.status === 200 })
  sleep(2)
}

function contentionCheckout() {
  const cartHash = 'a'.repeat(64)
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }
  const add = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/cart_add_item`,
    JSON.stringify({ p_cart_token_hash: cartHash, p_variant_id: SEED_VARIANT_ID, p_quantity: 1 }),
    { headers },
  )
  check(add, { 'cart_add 200': (r) => r.status === 200 })
  const order = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/place_order`,
    JSON.stringify({
      p_cart_token_hash: cartHash,
      p_idempotency_key: uuidv4(),
      p_order_access_token_hash: 'b'.repeat(64),
      p_customer: {
        customerName: 'k6 Load',
        customerPhone: '0901234567',
        customerEmail: '',
        province: 'HCM',
        district: 'Q1',
        ward: 'P1',
        streetAddress: '123 k6 street',
        note: '',
        paymentMethod: 'cod',
        fulfillmentMethod: 'delivery',
      },
      p_payment_method: 'cod',
      p_coupon_code: null,
    }),
    { headers },
  )
  check(order, {
    'place_order 200': (r) => r.status === 200,
    'no oversell': (r) => !String(r.body ?? '').includes('INTERNAL_ERROR'),
  })
  sleep(1)
}

export default function () {
  if (SEED_VARIANT_ID && SUPABASE_URL && SUPABASE_ANON_KEY) {
    contentionCheckout()
    return
  }
  warmBrowse()
}
