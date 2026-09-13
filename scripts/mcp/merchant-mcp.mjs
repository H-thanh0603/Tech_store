#!/usr/bin/env node
/**
 * Merchant MCP server (Managed-Agents path, TypeScript).
 *
 * Staff-scoped READS only (Bearer cookie sau login MFA /admin). Mọi write
 * của merchant agent vẫn là staged change qua approval surface
 * (/admin/assistant, SDK console merchant, approve API) — MCP không expose
 * apply/discard, provenance gates giữ nguyên phía host.
 *
 *   node scripts/mcp/merchant-mcp.mjs --cookie "sb-...=...; ..."
 */
import { baseArgs, defineTools, serve } from './mcp-frame.mjs'

const { args, base } = baseArgs()
const ci = args.indexOf('--cookie')
const COOKIE = (ci !== -1 && args[ci + 1] ? args[ci + 1] : (process.env.TECHSTORE_STAFF_COOKIE ?? '')).trim()
if (!COOKIE) {
  console.error('merchant-mcp: thiếu --cookie (staff session sau MFA).')
  process.exit(1)
}

async function staffGet(path) {
  const res = await fetch(`${base}${path}`, { headers: { cookie: COOKIE } })
  if (!res.ok) throw new Error(`merchant API HTTP ${res.status} for ${path}`)
  return res.json()
}

const tools = defineTools([
  {
    name: 'get_pending_changes',
    description: 'Change đang chờ duyệt (stage nhưng chưa apply/discard).',
    inputSchema: { type: 'object', properties: {} },
    call: async () => staffGet('/api/v1/assistant/merchant/pending'),
  },
  {
    name: 'list_campaign_briefs',
    description: 'Brief chiến dịch khuyến mãi đang chờ (advisory, thực hiện tay).',
    inputSchema: { type: 'object', properties: {} },
    call: async () => staffGet('/api/v1/assistant/merchant/campaigns'),
  },
  {
    name: 'get_latest_digest',
    description: 'Bản tin vận hành gần nhất từ health route (cron tổng hợp mỗi sáng).',
    inputSchema: { type: 'object', properties: {} },
    call: async () => {
      const health = await staffGet('/api/health')
      const digest = health.digest ?? health.merchant_digest ?? null
      return digest ?? { result: 'empty', hint: 'Chưa có bản tin — cron digest chạy mỗi sáng.' }
    },
  },
])

serve({ name: 'techstore-merchant', version: '1.0.0' }, tools)
