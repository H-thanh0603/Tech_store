/**
 * Shared streaming turn loop for both assistants. Mirrors the buffered loop
 * (same grounding, iteration ceiling, text-only final round) but yields text
 * deltas as they arrive and a single result at the end.
 */

import type Anthropic from '@anthropic-ai/sdk'

import type { MessagesClient } from './agent'

export type StreamEvent<R> = { type: 'text'; delta: string } | { type: 'result'; result: R }

interface StreamDriver<R> {
  model: string
  maxTokens: number
  maxIterations: number
  system: string
  tools: Anthropic.Tool[]
  messages: Anthropic.MessageParam[]
  forcedTool: string | null
  dispatch: (name: string, input: Record<string, unknown>) => Promise<string>
  /** Return true when the turn should stop after this round (e.g. suggestions). */
  shouldEnd: () => boolean
  /** Fallback reply when the model produced no text. */
  fallbackReply: string
  finish: (reply: string) => R
}

export async function* streamTurn<R>(
  client: MessagesClient,
  driver: StreamDriver<R>,
): AsyncGenerator<StreamEvent<R>> {
  const replyParts: string[] = []
  const { messages } = driver

  for (let round = 0; round <= driver.maxIterations; round += 1) {
    const forceText = round === driver.maxIterations
    const tool_choice: Anthropic.ToolChoice =
      forceText
        ? { type: 'none' }
        : round === 0 && driver.forcedTool
          ? { type: 'tool', name: driver.forcedTool }
          : { type: 'auto' }

    const params = {
      model: driver.model,
      max_tokens: driver.maxTokens,
      system: driver.system,
      tools: driver.tools,
      tool_choice,
      messages,
    }

    const assistantBlocks: Anthropic.ContentBlockParam[] = []
    const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = []

    try {
      if (client.messages.stream) {
        for await (const event of client.messages.stream(params)) {
          if (event.type === 'text_delta') {
            replyParts.push(event.text)
            yield { type: 'text', delta: event.text }
          } else {
            for (const block of event.content) {
              if (block.type === 'text') {
                assistantBlocks.push({ type: 'text', text: block.text })
              } else {
                toolUses.push({ id: block.id, name: block.name, input: block.input })
                assistantBlocks.push({
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input,
                })
              }
            }
          }
        }
      } else {
        const response = await client.messages.create(params)
        for (const block of response.content) {
          if (block.type === 'text') {
            if (block.text.trim()) {
              replyParts.push(block.text)
              yield { type: 'text', delta: block.text }
            }
            assistantBlocks.push({ type: 'text', text: block.text })
          } else {
            toolUses.push({ id: block.id, name: block.name, input: block.input })
            assistantBlocks.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            })
          }
        }
      }
    } catch {
      const reply = replyParts.join('').trim() || 'Xin lỗi, trợ lý đang bận. Bạn thử lại sau ít phút nhé.'
      yield { type: 'result', result: driver.finish(reply) }
      return
    }

    messages.push({ role: 'assistant', content: assistantBlocks })
    if (toolUses.length === 0 || forceText) break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      const text = await driver.dispatch(use.name, use.input)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: text })
    }
    messages.push({ role: 'user', content: results })
    if (driver.shouldEnd()) break
  }

  const reply = replyParts.join('').trim() || driver.fallbackReply
  yield { type: 'result', result: driver.finish(reply) }
}
