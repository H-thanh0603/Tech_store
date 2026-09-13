/**
 * Turn events shared by every runtime path. The Messages-API loop yields
 * text/result pairs; SDK consoles, MCP hosts and the managed manifests map
 * those onto these events so clients render one protocol:
 * text deltas, tool calls, domain UI, cart/change updates, turn completion.
 */

import type { PresentationPayload } from './presentation'

export type TurnEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string }
  | { type: 'ui'; ui: PresentationPayload }
  | { type: 'cart_update'; itemCount: number; subtotal: number }
  | { type: 'change_update'; staged: number }
  | { type: 'turn_complete'; cachedPrefixHit: boolean }

export interface CacheProbe {
  /** Provider-reported cache read tokens for the turn (0 = prefix changed). */
  cacheReadInputTokens: number
}

/**
 * Confirm prompt-cache health from a turn's usage probe: nonzero cached
 * tokens on a second turn means the system prefix stayed stable.
 */
export function prefixCacheHit(probe: CacheProbe | null): boolean {
  return (probe?.cacheReadInputTokens ?? 0) > 0
}

export function turnCompleteEvent(probe: CacheProbe | null = null): TurnEvent {
  return { type: 'turn_complete', cachedPrefixHit: prefixCacheHit(probe) }
}
