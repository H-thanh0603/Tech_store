#!/usr/bin/env node
/**
 * Scaffold a new commerce agent surface on the TechStore libraries.
 *
 *   node scripts/scaffold-commerce-agent.mjs --role shopping --name "ACME Books"
 *   node scripts/scaffold-commerce-agent.mjs --role merchant --name "ACME Books Ops"
 *
 * Generates: skills/<role>/_new/SKILL.md starter, a registry snippet to paste
 * into lib/commerce-agent/skills.ts, a managed manifest draft and an eval
 * placeholder in evals/commerce/. Never overwrites existing files.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(name)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

const role = flag('--role')
const name = flag('--name') ?? 'ACME Store'
if (!['shopping', 'merchant'].includes(role)) {
  console.error('Usage: node scripts/scaffold-commerce-agent.mjs --role <shopping|merchant> --name "<Name>"')
  process.exit(1)
}

const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'acme'
const writes = []

function put(path, content) {
  if (existsSync(path)) {
    console.log(`skip (exists): ${path}`)
    return
  }
  const dir = path.slice(0, path.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, content)
  writes.push(path)
  console.log(`wrote: ${path}`)
}

const starterFlows = role === 'shopping'
  ? ['search-discovery', 'purchase-research', 'planning-goals', 'customer-care', 'memory-personalization']
  : ['performance-insights', 'catalog-listings', 'inventory-operations', 'pricing-promotions', 'marketing-campaigns']

for (const flow of starterFlows) {
  put(
    `skills/scaffold/${slug}-${role}/${flow}/SKILL.md`,
    `# ${flow} (${name})\n\nPort từ skills/${role === 'shopping' ? 'shopping-agent' : 'merchant-agent'}/${flow}/SKILL.md: ` +
      `giữ nguyên gates/caps, thay backend methods bằng hệ thống của bạn. ` +
      `Hệ nào chưa có → switch OFF + park flow ở đây.\n`,
  )
}

put(
  `managed-agents/scaffold-${slug}-${role}.json`,
  JSON.stringify(
    {
      name: `${slug}-${role}-agent`,
      role,
      version: '0.1.0',
      skills: starterFlows,
      backend: 'map từng method sang service của bạn (xem docs/commerce-agents/backends.md)',
      safety: 'docs/commerce-agents/safety.md áp dụng trước khi mở cho người thật',
    },
    null,
    2,
  ) + '\n',
)

put(
  `evals/commerce/scaffold-${slug}-${role}.json`,
  JSON.stringify(
    [
      {
        prompt: role === 'shopping' ? 'tìm món bán chạy nhất dưới 10 triệu' : 'doanh thu tuần này thế nào',
        expect: { tool: role === 'shopping' ? 'search_products' : 'get_business_snapshot' },
      },
    ],
    null,
    2,
  ) + '\n',
)

console.log(`\nScaffolded ${writes.length} file(s) for "${name}" (${role}).`)
console.log('Tiếp theo (xem plugins/commerce-builder/scaffold-commerce-agent.md):')
console.log('  1. Map backend methods sang service của bạn (server-side, model chỉ đọc DTO).')
console.log('  2. Đăng ký skills vào lib/commerce-agent/skills.ts + manifest managed-agents/.')
console.log('  3. Viết eval (author-commerce-evals) rồi review (review-commerce-agent).')
