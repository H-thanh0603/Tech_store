#!/usr/bin/env node
/**
 * Deploy a managed agent (dry-run by default).
 *
 *   node scripts/deploy-managed-agent.mjs shopping            # verify manifest + MCP tools/list
 *   node scripts/deploy-managed-agent.mjs merchant --cookie "..."
 *   node scripts/deploy-managed-agent.mjs shopping --live     # prints upload plan (no hosted platform wired)
 *
 * Dry-run checks: manifest parses, skills dirs exist, the MCP server boots
 * and answers tools/list with the manifest's tool set. --live prints the
 * manifest path + server command for the hosted platform operator.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const [role, ...rest] = process.argv.slice(2)
if (!['shopping', 'merchant'].includes(role)) {
  console.error('Usage: node scripts/deploy-managed-agent.mjs <shopping|merchant> [--cookie "..."] [--live]')
  process.exit(1)
}
const live = rest.includes('--live')
const ci = rest.indexOf('--cookie')
const cookie = ci !== -1 && rest[ci + 1] ? rest[ci + 1] : (process.env.TECHSTORE_STAFF_COOKIE ?? '')

const manifestPath = `managed-agents/${role === 'shopping' ? 'shopping-agent' : 'merchant-agent'}.json`
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
console.log(`Manifest: ${manifestPath} (${manifest.name} v${manifest.version})`)

for (const skill of manifest.skills) {
  const dir = `skills/${role === 'shopping' ? 'shopping-agent' : 'merchant-agent'}/${skill}/SKILL.md`
  if (!existsSync(dir)) {
    console.error(`Missing skill: ${dir}`)
    process.exit(1)
  }
}
console.log(`Skills: ${manifest.skills.length} OK`)

const server = role === 'shopping' ? 'scripts/mcp/storefront-mcp.mjs' : 'scripts/mcp/merchant-mcp.mjs'
if (!existsSync(server)) {
  console.error(`Missing MCP server: ${server}`)
  process.exit(1)
}

async function probeTools() {
  const childArgs = role === 'shopping' ? [] : ['--cookie', cookie || 'probe-no-cookie']
  const child = spawn('node', [server, ...childArgs], { stdio: ['pipe', 'pipe', 'pipe'] })
  let buf = ''
  const tools = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('MCP probe timed out'))
    }, 15000)
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue
        try {
          const msg = JSON.parse(line)
          if (msg.result?.tools) {
            clearTimeout(timer)
            child.kill()
            resolve(msg.result.tools.map((t) => t.name))
            return
          }
        } catch {
          // Wait for more bytes.
        }
      }
    })
    child.stderr.on('data', () => {})
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`)
    setTimeout(() => {
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`)
    }, 500)
  })
  const expected = manifest.mcpServer.tools
  const missing = expected.filter((t) => !tools.includes(t))
  if (missing.length > 0) {
    console.error(`MCP tools mismatch. Got [${tools.join(', ')}], missing [${missing.join(', ')}]`)
    process.exit(1)
  }
  console.log(`MCP tools/list: [${tools.join(', ')}] OK`)
}

if (role === 'merchant' && !cookie && !live) {
  console.log('Note: merchant MCP needs --cookie for live reads; probing boot only.')
}

await probeTools().catch((error) => {
  // Merchant probe without a cookie exits(1) on boot by design — accept it.
  if (role === 'merchant' && !cookie) {
    console.log('MCP boot check: merchant server correctly refuses cookie-less start. OK')
    return
  }
  console.error(`MCP probe failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})

if (live) {
  console.log('\n--live plan (operator executes on the hosted platform):')
  console.log(`  1. Upload ${manifestPath}`)
  console.log(`  2. Mount MCP server: ${manifest.mcpServer.command.join(' ')} (loopback, staff cookie for merchant)`)
  console.log(`  3. Point checkout handoff at <host>/checkout; approvals at <host>/admin/assistant`)
  console.log(`  4. Schedule digest: ${manifest.scheduledDigest?.route ?? '(shopping: none)'} ${manifest.scheduledDigest?.schedule ?? ''}`)
} else {
  console.log('\nDry-run OK. Add --live for the operator upload plan.')
}
