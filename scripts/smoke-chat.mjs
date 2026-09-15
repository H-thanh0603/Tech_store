#!/usr/bin/env node
/**
 * Live smoke conversation (needs a provider key on the server + dev server).
 * Key: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY (+ASSISTANT_PROVIDER=deepseek),
 * OPENROUTER_API_KEY (+ASSISTANT_PROVIDER=openrouter, ASSISTANT_MODEL=...),
 * or TOKENROUTER_API_KEY (+ASSISTANT_PROVIDER=tokenrouter, ASSISTANT_MODEL=...).
 *   node scripts/smoke-chat.mjs --vertical retail [--base http://localhost:3000]
 * Travel/telecom/entertainment print their TRY cards (lib covered by vitest).
 */
const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(name)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}
const vertical = flag('--vertical') ?? 'retail'
const base = ((flag('--base') ?? process.env.TECHSTORE_BASE ?? 'http://localhost:3000')).replace(/\/$/, '')
// Free-tier gateways (e.g. TokenRouter glm free: 8 req/min) need spacing
// between prompts — a single turn can fan out to 6 model calls.
//   node scripts/smoke-chat.mjs --vertical retail --delay 25000
const delayMs = Number(flag('--delay') ?? process.env.SMOKE_DELAY_MS ?? 0) || 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TRY = {
  travel: 'Lên lịch Đà Lạt 3N2Đ đầu tháng 10, ngân sách 10 triệu (good: xác nhận ngày, buildItinerary, báo chặng hết chỗ, render itinerary).',
  telecom: 'Nhà 2 lines, gói nào rẻ nhất đủ 120GB? (good: plan-matrix all-in + fee-disclosure, cheapest rõ ràng).',
  entertainment: 'Giữ 2 vé show cuối tuần 15 phút (good: hold_id + expires_at, render hold-status).',
}

if (vertical !== 'retail') {
  if (!TRY[vertical]) {
    console.error(`Unknown vertical: ${vertical} (retail|travel|telecom|entertainment)`)
    process.exit(1)
  }
  console.log(`[${vertical}] TRY: ${TRY[vertical]}`)
  console.log(`[${vertical}] Lib covered by: tests/verticals/${vertical}.test.ts`)
  process.exit(0)
}

const prompts = [
  'Chào shop, mình cần laptop học tập dưới 20 triệu',
  'So sánh 2 máy rẻ nhất giúp mình',
  'Chính sách đổi trả thế nào?',
]

let failed = 0
for (const [i, prompt] of prompts.entries()) {
  if (i > 0 && delayMs > 0) await sleep(delayMs)
  const res = await fetch(`${base}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
  })
  const json = await res.json().catch(() => ({}))
  const ok = res.ok && typeof json.reply === 'string' && json.reply.length > 0 && !json.disabled
  console.log(`${ok ? 'PASS' : 'FAIL'}: "${prompt}" → ${(json.reply ?? '').slice(0, 100)}${json.disabled ? ' [DISABLED: no key]' : ''}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
