#!/usr/bin/env node
/**
 * Storefront MCP server (Managed-Agents path, TypeScript).
 *
 * Read-only tools over the public agent layer (/api/v1/agents/*): the same
 * catalog/cart-policy/order systems the shopping assistant uses, served to a
 * hosted agent. No writes here — checkout hands off to the host (/checkout),
 * and stock is never reserved at stage time.
 *
 * Transport: NDJSON over stdio (initialize, tools/list, tools/call).
 *   node scripts/mcp/storefront-mcp.mjs [--base http://localhost:3000]
 */
import { baseArgs, defineTools, serve } from './mcp-frame.mjs'

const { base } = baseArgs()

async function get(path) {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`storefront API HTTP ${res.status} for ${path}`)
  return res.json()
}

const tools = defineTools([
  {
    name: 'search_products',
    description: 'Tìm sản phẩm TechStore (q, category, brand, maxPrice). Tối đa 6 kết quả.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        brand: { type: 'string' },
        max_price: { type: 'number' },
      },
      required: ['query'],
    },
    call: async ({ query, category, brand, max_price }) => {
      const q = new URLSearchParams({ q: String(query ?? '') })
      if (category) q.set('category', String(category))
      if (brand) q.set('brand', String(brand))
      if (typeof max_price === 'number') q.set('maxPrice', String(max_price))
      return get(`/api/v1/agents/products?${q.toString()}`)
    },
  },
  {
    name: 'get_product_details',
    description: 'Chi tiết sản phẩm theo slug: biến thể, thông số, ảnh.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    call: async ({ slug }) => get(`/api/v1/agents/products/${encodeURIComponent(String(slug))}`),
  },
  {
    name: 'compare_products',
    description: 'So sánh 2–4 sản phẩm (slugs CSV hoặc mảng) + tóm tắt rẻ nhất/còn hàng.',
    inputSchema: {
      type: 'object',
      properties: { slugs: { type: 'string', description: 'CSV, ví dụ "a,b"' } },
      required: ['slugs'],
    },
    call: async ({ slugs }) => {
      const csv = Array.isArray(slugs) ? slugs.join(',') : String(slugs)
      return get(`/api/v1/agents/compare?slugs=${encodeURIComponent(csv)}`)
    },
  },
  {
    name: 'track_order',
    description: 'Tra cứu đơn bằng mã đơn + SĐT (phone-verified, read-only, không mint token).',
    inputSchema: {
      type: 'object',
      properties: { order_code: { type: 'string' }, phone: { type: 'string' } },
      required: ['order_code', 'phone'],
    },
    call: async ({ order_code, phone }) => {
      const q = new URLSearchParams({ order_code: String(order_code), phone: String(phone) })
      return get(`/api/v1/agents/orders?${q.toString()}`)
    },
  },
  {
    name: 'search_policies',
    description: 'Chính sách đã công bố (đổi trả, bảo hành...). Lọc theo query phía server MCP.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    call: async ({ query }) => {
      const all = await get('/api/v1/agents/policies')
      const needle = String(query ?? '').toLowerCase()
      const list = Array.isArray(all.policies) ? all.policies : Array.isArray(all) ? all : []
      const hits = list
        .filter((p) => JSON.stringify(p).toLowerCase().includes(needle))
        .slice(0, 3)
      return { query, policies: hits }
    },
  },
])

serve({ name: 'techstore-storefront', version: '1.0.0' }, tools)
