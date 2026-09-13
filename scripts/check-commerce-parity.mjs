#!/usr/bin/env node
/**
 * Parity gate: every commerce-agents surface must exist and agree.
 *   node scripts/check-commerce-parity.mjs
 * Checks: 10 skills, _staged README, manifests ↔ skill dirs, MCP servers,
 * plugin commands, docs, eval fixtures (valid JSON, prompt+expect).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'

let failed = 0
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`)
  if (!cond) failed += 1
}

const shopping = ['search-discovery', 'purchase-research', 'planning-goals', 'customer-care', 'memory-personalization']
const merchant = ['performance-insights', 'catalog-listings', 'inventory-operations', 'pricing-promotions', 'marketing-campaigns']

for (const s of shopping) ok(existsSync(`skills/shopping-agent/${s}/SKILL.md`), `skill shopping/${s}`)
for (const s of merchant) ok(existsSync(`skills/merchant-agent/${s}/SKILL.md`), `skill merchant/${s}`)
ok(existsSync('skills/_staged/README.md'), 'skills/_staged/README.md')

for (const [file, , list] of [
  ['managed-agents/shopping-agent.json', 'shopping-agent', shopping],
  ['managed-agents/merchant-agent.json', 'merchant-agent', merchant],
]) {
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8'))
  } catch { /* handled below */ }
  ok(!!manifest, `manifest parses: ${file}`)
  if (manifest) {
    ok(JSON.stringify([...manifest.skills].sort()) === JSON.stringify([...list].sort()), `manifest skills match dirs: ${file}`)
    for (const part of manifest.mcpServer?.command ?? []) {
      if (typeof part === 'string' && part.endsWith('.mjs')) ok(existsSync(part), `mcp server exists: ${part}`)
    }
  }
}

for (const cmd of ['scaffold-commerce-agent', 'add-commerce-flow', 'author-commerce-evals', 'review-commerce-agent']) {
  ok(existsSync(`plugins/commerce-builder/${cmd}.md`), `plugin command: ${cmd}`)
}
for (const doc of ['safety', 'backends', 'deployment', 'verticals']) {
  ok(existsSync(`docs/commerce-agents/${doc}.md`), `doc: ${doc}.md`)
}
for (const sdk of ['scripts/commerce-sdk/shopping.mjs', 'scripts/commerce-sdk/merchant.mjs']) {
  ok(existsSync(sdk), sdk)
}

let evalCount = 0
if (existsSync('evals/commerce')) {
  for (const f of readdirSync('evals/commerce').filter((f) => f.endsWith('.json'))) {
    try {
      const cases = JSON.parse(readFileSync(`evals/commerce/${f}`, 'utf8'))
      const valid = Array.isArray(cases) && cases.every((c) => typeof c.prompt === 'string' && c.expect && typeof c.expect === 'object')
      ok(valid, `eval fixture: ${f} (${cases.length} cases)`)
      evalCount += cases.length
    } catch {
      ok(false, `eval fixture parses: ${f}`)
    }
  }
} else {
  ok(false, 'evals/commerce/ exists')
}
ok(evalCount > 0, `eval cases total: ${evalCount}`)

process.exit(failed > 0 ? 1 : 0)
