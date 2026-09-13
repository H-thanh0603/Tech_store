#!/usr/bin/env node
/**
 * Merchant Agent SDK console with approving review (TypeScript path).
 *
 * Same prompt, skills and staged-write contracts as /admin/assistant.
 * Every staged change pauses for y/N here — the model can never apply.
 *
 * Auth: paste the browser session cookie after MFA login in /admin:
 *   node scripts/commerce-sdk/merchant.mjs --cookie "sb-access-token=...; ..."
 *   node scripts/commerce-sdk/merchant.mjs --cookie "..." --once "doanh thu tuần này thế nào"
 */
import readline from 'node:readline'

const args = process.argv.slice(2)

function flag(name) {
  const i = args.indexOf(name)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

const BASE = (flag('--base') ?? process.env.TECHSTORE_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
const ONCE = flag('--once')
const COOKIE = flag('--cookie') ?? process.env.TECHSTORE_STAFF_COOKIE ?? ''
if (!COOKIE) {
  console.error('Thiếu session staff: đăng nhập /admin (qua MFA), copy cookie trình duyệt rồi truyền --cookie "...".')
  process.exit(1)
}

const headers = { 'content-type': 'application/json', cookie: COOKIE }

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`)
  return json
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (q) => new Promise((resolve) => rl.question(q, resolve))

async function reviewStaged(staged) {
  for (const s of staged ?? []) {
    const change = s.change ?? s
    console.log(`\n[STAGED] ${change.kind} — ${change.summary ?? change.id}`)
    for (const item of change.items ?? []) console.log(`    - ${JSON.stringify(item)}`)
    const answer = (await question('Duyệt & áp dụng? (y/N): ')).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') {
      try {
        const result = await post('/api/v1/assistant/merchant/approve', { changeId: change.id, decision: 'apply' })
        console.log(`  → ${result.message ?? 'Đã áp dụng.'}`)
      } catch (error) {
        console.error(`  → Lỗi: ${error instanceof Error ? error.message : error}`)
      }
    } else {
      try {
        await post('/api/v1/assistant/merchant/approve', { changeId: change.id, decision: 'discard' })
        console.log('  → Đã bỏ change.')
      } catch (error) {
        console.error(`  → Lỗi: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
}

const history = []

async function turn(text) {
  history.push({ role: 'user', content: text.slice(0, 1000) })
  const json = await post('/api/v1/assistant/merchant/chat', { messages: history.slice(-10) })
  history.push({ role: 'assistant', content: String(json.reply ?? '').slice(0, 1000) })
  console.log(`\n${json.reply ?? ''}`)
  if ((json.suggestions ?? []).length > 0) console.log(`\nGợi ý: ${json.suggestions.join(' · ')}`)
  await reviewStaged(json.staged)
}

if (ONCE) {
  await turn(ONCE)
  rl.close()
  process.exit(0)
}

console.log(`Trợ lý vận hành (SDK console, base ${BASE}). "exit" để thoát.`)
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
