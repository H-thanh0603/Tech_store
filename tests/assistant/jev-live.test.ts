import { describe, expect, it } from 'vitest'

/**
 * Opt-in live probe for the Jev decision layer: talks to the real gateway
 * configured in JEV_BASE_URL (OpenRouter cloud or a local gateway such as
 * 9router). Skipped unless JEV_LIVE_PROBE=1 and a key are present, so CI
 * never depends on network access or a running gateway.
 *
 *   JEV_LIVE_PROBE=1 JEV_API_KEY=... JEV_BASE_URL=http://localhost:20128/v1 \
 *   JEV_MODEL=<tool-capable-model> \
 *   npx vitest run tests/assistant/jev-live.test.ts
 */
const KEY = process.env.JEV_API_KEY ?? process.env.TOKENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY
const canRun = !!KEY && process.env.JEV_LIVE_PROBE === '1'

describe.skipIf(!canRun)('jev live probe', () => {
  it('gets a typed scope decision from the configured gateway', async () => {
    process.env.JEV_API_KEY = KEY
    const { resolveShoppingScope } = await import('@/lib/assistant/jev')
    const out = await resolveShoppingScope('dự báo thời tiết ngày mai thế nào', { check: () => 'gray' })
    expect(out.source).toBe('keyword+jev')
    expect(out.verdict).toBe('off-topic')
  }, 60_000)

  it('gets a relevance order for catalog candidates', async () => {
    process.env.JEV_API_KEY = KEY
    const { jevRankIndices } = await import('@/lib/assistant/jev')
    const indices = await jevRankIndices('laptop học tập', [
      { product_id: 'a', name: 'MacBook Pro 16 M4 Max', brand: 'Apple', price: 89990000 },
      { product_id: 'b', name: 'Laptop Asus Vivobook 15 học sinh sinh viên', brand: 'Asus', price: 12990000 },
      { product_id: 'c', name: 'Chuột không dây Logitech M170', brand: 'Logitech', price: 290000 },
    ])
    expect(indices?.length).toBeGreaterThan(0)
  }, 60_000)
})
