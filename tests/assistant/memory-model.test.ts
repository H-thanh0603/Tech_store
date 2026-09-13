import { describe, expect, it, vi } from 'vitest'

import {
  parseMemoryExtractionJson,
  updateMemoryWithModel,
  type MemoryDb,
  type MemoryModelClient,
} from '@/lib/assistant/memory'

function fakeDb(facts: unknown = {}): MemoryDb & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push('select')
            return { data: { facts }, error: null }
          },
        }),
      }),
      upsert: async () => {
        calls.push('upsert')
        return { error: null }
      },
    }),
  }
}

function fakeClient(text: string): MemoryModelClient {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text }] }),
    },
  }
}

describe('parseMemoryExtractionJson', () => {
  it('accepts valid budgets in range and drops out-of-range ones', () => {
    expect(parseMemoryExtractionJson({ budget_vnd: 20000000 }).budget_vnd).toBe(20000000)
    expect(parseMemoryExtractionJson({ budget_vnd: 100 }).budget_vnd).toBeUndefined()
    expect(parseMemoryExtractionJson({ budget_vnd: 999999999 }).budget_vnd).toBeUndefined()
  })

  it('rejects non-objects and strips phone-like strings', () => {
    expect(parseMemoryExtractionJson(null)).toEqual({})
    expect(parseMemoryExtractionJson('{}')).toEqual({})
    expect(parseMemoryExtractionJson([])).toEqual({})
    const facts = parseMemoryExtractionJson({
      use_cases: ['gaming', '0901234567'],
      brands: [' Dell ', 42],
    })
    expect(facts.use_cases).toEqual(['gaming'])
    expect(facts.brands).toEqual(['dell'])
  })
})

describe('updateMemoryWithModel', () => {
  it('extracts, merges and stores model facts', async () => {
    const db = fakeDb({ brands: ['apple'] })
    const merged = await updateMemoryWithModel(
      'session-1',
      ['Mình cần laptop gaming khoảng 30 triệu'],
      fakeClient('{"budget_vnd": 30000000, "use_cases": ["gaming"]}'),
      'test-model',
      db,
    )
    expect(merged.budget_vnd).toBe(30000000)
    expect(merged.use_cases).toContain('gaming')
    expect(merged.brands).toContain('apple')
    expect(db.calls).toContain('upsert')
  })

  it('never sends phone-like texts and falls back on bad JSON', async () => {
    const seen: string[] = []
    const client: MemoryModelClient = {
      messages: {
        create: async (params) => {
          seen.push(params.messages[0].content)
          return { content: [{ type: 'text', text: 'not json' }] }
        },
      },
    }
    const db = fakeDb({})
    const merged = await updateMemoryWithModel(
      'session-2',
      ['liên hệ 0901234567 nhé', 'mình thích sony'],
      client,
      'test-model',
      db,
    )
    expect(seen[0]).not.toContain('0901234567')
    expect(merged).toEqual({})
    expect(db.calls).not.toContain('upsert')
  })

  it('fails closed when the model call throws', async () => {
    const client: MemoryModelClient = {
      messages: {
        create: async () => {
          throw new Error('provider down')
        },
      },
    }
    const merged = await updateMemoryWithModel('s', ['gaming'], client, 'm', fakeDb({}))
    expect(merged).toEqual({})
  })
})

describe('updateMemoryWithModel client seam', () => {
  it('uses vi.fn-backed client without touching the network', async () => {
    const create = vi.fn(
      async (): Promise<{ content: { type: 'text'; text: string }[] }> => ({
        content: [{ type: 'text', text: '{"brands":["jbl"]}' }],
      }),
    )
    const merged = await updateMemoryWithModel('s', ['loa jbl nghe nhạc'], { messages: { create } }, 'm', fakeDb({}))
    expect(create).toHaveBeenCalledOnce()
    expect(merged.brands).toContain('jbl')
  })
})
