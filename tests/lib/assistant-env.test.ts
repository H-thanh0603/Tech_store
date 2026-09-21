import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  loadAssistantEnv,
  parseEnvFile,
  resetAssistantEnvCache,
  ASSISTANT_ENV_FILE,
} from '@/lib/env/assistant-env'

const roots: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'techstore-env-'))
  roots.push(dir)
  return dir
}

function writeEnv(dir: string, name: string, body: string): void {
  writeFileSync(join(dir, name), body, 'utf8')
}

afterEach(() => {
  resetAssistantEnvCache()
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('parseEnvFile', () => {
  it('reads keys, skips comments and blanks', () => {
    const parsed = parseEnvFile(
      [
        '# a comment',
        '',
        'ASSISTANT_PROVIDER=deepseek',
        '  ASSISTANT_MODEL = deepseek-chat  ',
        'NOT_A_LINE',
        '#JEV_MODEL=typesafe/jev-latest',
        '1BAD=x',
      ].join('\n'),
    )
    expect(parsed).toEqual({
      ASSISTANT_PROVIDER: 'deepseek',
      ASSISTANT_MODEL: 'deepseek-chat',
    })
  })

  it('keeps values containing # and strips quoted values and inline comments', () => {
    const parsed = parseEnvFile(
      [
        'KEY_WITH_HASH=abc#def',
        'QUOTED="value # not a comment"',
        "SINGLE='also fine'",
        'TRAILING=plain  # note',
        'EMPTY=',
      ].join('\n'),
    )
    expect(parsed).toEqual({
      KEY_WITH_HASH: 'abc#def',
      QUOTED: 'value # not a comment',
      SINGLE: 'also fine',
      TRAILING: 'plain',
      EMPTY: '',
    })
  })
})

describe('loadAssistantEnv', () => {
  it('reports no file when .env.assistant is absent (fail-open)', () => {
    const target: Record<string, string | undefined> = {}
    const result = loadAssistantEnv({
      root: tempDir(),
      target,
      quiet: true,
      force: true,
    })
    expect(result).toEqual({ file: null, keys: [] })
    expect(target).toEqual({})
  })

  it('loads the dedicated file and wins over an existing value by default', () => {
    const dir = tempDir()
    writeEnv(dir, ASSISTANT_ENV_FILE, 'ASSISTANT_MODEL=from-file\nJEV_MODEL=jev-file\n')
    const target: Record<string, string | undefined> = {
      ASSISTANT_MODEL: 'from-env-local',
    }
    const result = loadAssistantEnv({
      root: dir,
      target,
      quiet: true,
      force: true,
    })
    expect(result.keys.sort()).toEqual(['ASSISTANT_MODEL', 'JEV_MODEL'])
    expect(target.ASSISTANT_MODEL).toBe('from-file')
    expect(target.JEV_MODEL).toBe('jev-file')
  })

  it('keeps pre-existing values when precedence is process (CI/Vercel)', () => {
    const dir = tempDir()
    writeEnv(dir, ASSISTANT_ENV_FILE, 'ASSISTANT_MODEL=from-file\nJEV_MODEL=jev-file\n')
    const target: Record<string, string | undefined> = {
      ASSISTANT_MODEL: 'from-ci',
    }
    loadAssistantEnv({
      root: dir,
      target,
      precedence: 'process',
      quiet: true,
      force: true,
    })
    expect(target.ASSISTANT_MODEL).toBe('from-ci')
    expect(target.JEV_MODEL).toBe('jev-file')
  })

  it('treats a blank value as "not set" so it cannot wipe a real value', () => {
    const dir = tempDir()
    writeEnv(dir, ASSISTANT_ENV_FILE, 'ASSISTANT_MODEL=\nJEV_MODEL=jev-file\nSITE_URL=\n')
    const target: Record<string, string | undefined> = {
      ASSISTANT_MODEL: 'kept',
      SITE_URL: 'https://techstore.vn',
    }
    const result = loadAssistantEnv({
      root: dir,
      target,
      quiet: true,
      force: true,
    })
    expect(result.keys).toEqual(['JEV_MODEL'])
    expect(target.ASSISTANT_MODEL).toBe('kept')
    expect(target.SITE_URL).toBe('https://techstore.vn')
  })

  it('honours ASSISTANT_ENV_FILE and memoizes a single load per process', () => {
    const dir = tempDir()
    writeEnv(dir, 'custom.env', 'JEV_MODEL=custom\n')
    const target: Record<string, string | undefined> = {}
    const first = loadAssistantEnv({
      root: dir,
      file: 'custom.env',
      target,
      quiet: true,
      force: true,
    })
    expect(first.keys).toEqual(['JEV_MODEL'])
    // Memoized: a second call without `force` returns the cached result and
    // does not re-read, even if the file changed underneath.
    writeEnv(dir, 'custom.env', 'JEV_MODEL=changed\n')
    const second = loadAssistantEnv({
      root: dir,
      file: 'custom.env',
      target,
      quiet: true,
    })
    expect(second).toBe(first)
    expect(target.JEV_MODEL).toBe('custom')
  })
})
