#!/usr/bin/env node
/**
 * Shopping Agent SDK console (TypeScript path).
 *
 * Same prompt, skills and tools as the web widget — the turn loop runs
 * server-side in lib/assistant via @anthropic-ai/sdk; this script is the
 * host application around it (keeps history, cart cookies, renders cards).
 *
 *   node scripts/commerce-sdk/shopping.mjs --once "laptop học tập dưới 20 triệu"
 *   node scripts/commerce-sdk/shopping.mjs [--base http://localhost:3000]
 */
import readline from 'node:readline'

const args = process.argv.slice(2)

function flag(name) {
  const i = args.indexOf(name)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

const BASE = (flag('--base') ?? process.env.TECHSTORE_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
const ONCE = flag('--once')
const SESSION_ID = flag('--session-id') ?? `sdk-${Date.now().toString(36)}`

const jar = []
function storeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? []
  for (const c of set) jar.push(c.split(';')[0])
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jar.length > 0 ? { cookie: jar.join('; ') } : {}) },
    body: JSON.stringify(body),
  })
  storeCookies(res)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`)
  return json
}

function printTurn(json) {
  console.log(`\n${json.reply ?? ''}`)
  for (const c of json.cards ?? []) {
    console.log(`  • ${c.name} — ${Number(c.price ?? 0).toLocaleString('vi-VN')}₫ (${c.in_stock ? 'còn hàng' : 'hết hàng'}) /products/${c.slug}`)
  }
  if ((json.suggestions ?? []).length > 0) console.log(`\nGợi ý: ${(json.suggestions ?? []).join(' · ')}`)
  if (json.disabled) console.log('\n[Lưu ý: assistant chưa được cấu hình key trên server.]')
}

const history = []

async function turn(text) {
  history.push({ role: 'user', content: text.slice(0, 1000) })
  const json = await post('/api/v1/assistant/chat', {
    messages: history.slice(-10),
    sessionId: SESSION_ID,
  })
  history.push({ role: 'assistant', content: String(json.reply ?? '').slice(0, 1000) })
  printTurn(json)
}

if (ONCE) {
  await turn(ONCE)
  process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
console.log(`Trợ lý TechStore (SDK console, base ${BASE}). Gõ câu hỏi, "exit" để thoát.`)
const ask = () => {
  rl.question('\nBạn: ', async (line) => {
    if (line.trim().toLowerCase() === 'exit') {
      rl.close()
      return
    }
    if (!line.trim()) {
      ask()
      return
    }
    try {
      await turn(line.trim())
    } catch (error) {
      console.error(`Lỗi: ${error instanceof Error ? error.message : error}`)
    }
    ask()
  })
}
ask()
