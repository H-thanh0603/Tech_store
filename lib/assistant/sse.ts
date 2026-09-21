/**
 * Minimal Server-Sent Events plumbing for assistant chat.
 * Event frames: {type:'text',delta} … {type:'activity',call:AgentCall}
 * (Real-time Agent Activity UI, fired per tool call; generic in R so it does
 * not constrain payloads) … final {type:'result',result}.
 */

import type { AgentCall } from './activity'
import type { StreamEvent } from './stream'

export function sseEncode(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function streamToSSE<R>(gen: AsyncGenerator<StreamEvent<R>>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encode = new TextEncoder()
      try {
        for await (const event of gen) {
          controller.enqueue(encode.encode(sseEncode(event)))
        }
      } catch {
        controller.enqueue(
          encode.encode(sseEncode({ type: 'result', result: null, error: 'stream_failed' })),
        )
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}

/** Client-side SSE reader for POST chat streams. Calls onText per delta, onActivity per tool call, resolves the result. */
export async function readChatStream<R>(
  res: Response,
  onText: (delta: string) => void,
  onActivity?: (call: AgentCall) => void,
): Promise<R> {
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: R | null = null
  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    try {
      const event = JSON.parse(trimmed.slice(5).trim()) as
        | { type: 'text'; delta: string }
        | { type: 'activity'; call?: AgentCall; activity?: AgentCall }
        | { type: 'result'; result: R }
      if (event.type === 'text') onText(event.delta)
      else if (event.type === 'activity') {
        const call = event.call ?? event.activity
        if (call) onActivity?.(call)
      } else result = event.result
    } catch {
      // Partial frame: more bytes coming.
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      for (const line of frame.split('\n')) handleLine(line)
    }
  }
  // Flush: a final frame without trailing \n\n would otherwise be lost.
  buffer += decoder.decode()
  for (const line of buffer.split('\n')) handleLine(line)
  if (result === null) throw new Error('stream ended without result')
  return result
}
