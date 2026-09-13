#!/usr/bin/env node
/**
 * Shared NDJSON stdio frame for the TechStore MCP servers.
 * Protocol: initialize → { protocolVersion, capabilities, serverInfo },
 * tools/list, tools/call → { content: [{ type: 'text', text }] }.
 */
import readline from 'node:readline'

export function baseArgs() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--base')
  const base = (i !== -1 && args[i + 1] ? args[i + 1] : (process.env.TECHSTORE_BASE ?? 'http://localhost:3000')).replace(/\/$/, '')
  return { args, base }
}

export function defineTools(list) {
  const map = new Map()
  for (const t of list) map.set(t.name, t)
  return map
}

export function serve(serverInfo, tools) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
  const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)

  rl.on('line', async (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    const { id, method, params } = msg
    const reply = (result) => send({ jsonrpc: '2.0', id, result })
    const fail = (code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

    try {
      if (method === 'initialize') {
        reply({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo,
        })
      } else if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
        // No reply for notifications.
      } else if (method === 'ping') {
        reply({})
      } else if (method === 'tools/list') {
        reply({
          tools: [...tools.values()].map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        })
      } else if (method === 'tools/call') {
        const tool = tools.get(params?.name)
        if (!tool) {
          fail(-32602, `Unknown tool: ${params?.name}`)
          return
        }
        const data = await tool.call(params?.arguments ?? {})
        reply({ content: [{ type: 'text', text: JSON.stringify(data).slice(0, 6000) }] })
      } else {
        fail(-32601, `Method not found: ${method}`)
      }
    } catch (error) {
      fail(-32603, error instanceof Error ? error.message : 'tool failed')
    }
  })
}
