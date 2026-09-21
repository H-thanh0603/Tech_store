/**
 * Dedicated env file for the AI assistant credentials (LLM chat + Jev
 * decision layer), kept out of `.env.local` so the model/key block has one
 * obvious home and can be swapped without touching Supabase/VNPay/etc.
 *
 * File: `.env.assistant` (git-ignored). Template: `.env.assistant.example`.
 * Override the path with `ASSISTANT_ENV_FILE` (absolute or root-relative).
 *
 * Precedence is **file-wins** by default: a key defined in `.env.assistant`
 * replaces whatever `.env` / `.env.local` / the shell already set, so editing
 * this one file is enough. CI and Vercel usually want the opposite — set
 * `ASSISTANT_ENV_PRECEDENCE=process` there so a real environment variable
 * always beats the file.
 *
 * Server-only (uses node:fs). Loaded from `next.config.ts`, `tests/setup.ts`
 * and `lib/assistant/config.ts`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

export const ASSISTANT_ENV_FILE = '.env.assistant'

export interface LoadedAssistantEnv {
  /** Absolute path that was read, or null when no file was present. */
  file: string | null
  /** Keys the file actually defined (empty when the file is absent). */
  keys: string[]
}

let loaded: LoadedAssistantEnv | null = null

/** Strip surrounding quotes, then a trailing ` # comment` on unquoted values. */
function normalizeValue(raw: string): string {
  const value = raw.trim()
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' || first === "'") && last === first) return value.slice(1, -1)
  }
  const comment = value.indexOf(' #')
  return (comment === -1 ? value : value.slice(0, comment)).trim()
}

/** Minimal dotenv parser: `KEY=value`, `#` comments, blank lines ignored. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    out[key] = normalizeValue(line.slice(eq + 1))
  }
  return out
}

function resolvePath(root: string, file: string): string {
  return isAbsolute(file) ? file : join(root, file)
}

/**
 * Read `.env.assistant` into process.env. Idempotent per process unless
 * `force` is set (tests call it with an explicit file + force).
 */
export function loadAssistantEnv(options?: {
  root?: string
  file?: string
  precedence?: 'file' | 'process'
  force?: boolean
  quiet?: boolean
  /** Destination for the parsed values; defaults to process.env. */
  target?: Record<string, string | undefined>
}): LoadedAssistantEnv {
  if (loaded && !options?.force) return loaded

  const root = options?.root ?? process.env.ASSISTANT_ENV_ROOT ?? process.cwd()
  const file = resolvePath(
    root,
    options?.file ?? process.env.ASSISTANT_ENV_FILE ?? ASSISTANT_ENV_FILE,
  )
  const precedence =
    options?.precedence ?? (process.env.ASSISTANT_ENV_PRECEDENCE === 'process' ? 'process' : 'file')
  const target = options?.target ?? process.env

  if (!existsSync(file)) {
    loaded = { file: null, keys: [] }
    return loaded
  }

  let values: Record<string, string>
  try {
    values = parseEnvFile(readFileSync(file, 'utf8'))
  } catch {
    // Fail-open: an unreadable credentials file must not take the app down;
    // the assistant already degrades to "chưa được cấu hình" without a key.
    loaded = { file: null, keys: [] }
    return loaded
  }

  const keys: string[] = []
  for (const [key, value] of Object.entries(values)) {
    // A blank value means "not set" — the template ships every optional key
    // commented-out-but-present, and an empty line must never wipe a real
    // value coming from .env.local or the platform (SITE_URL, staging secret).
    if (value === '') continue
    // `process` precedence keeps anything already defined.
    if (precedence === 'process' && target[key] !== undefined) continue
    target[key] = value
    keys.push(key)
  }

  loaded = { file, keys }
  if (!options?.quiet && keys.length > 0 && process.env.NODE_ENV !== 'test' && !process.env.CI) {
    console.log(`- Assistant env: ${file.replace(`${root}/`, '')} (${keys.length} keys)`)
  }
  return loaded
}

/** Test helper: forget the memoized load so the next call re-reads the file. */
export function resetAssistantEnvCache(): void {
  loaded = null
}
