const TOKEN_BYTE_LENGTH = 32

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function createOpaqueToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

// Legacy SHA-256 hex — kept ONLY for dual-read migration of rows written
// before TOKEN_PEPPER was set. New code must call hashToken().
export async function sha256Hex(value: string): Promise<string> {
  const input = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', input)

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Defense-in-depth: khi TOKEN_PEPPER được đặt (32+ ký tự random ở prod),
// token hash dùng HMAC-SHA256 với pepper thay vì SHA-256 trần — DB leak đơn
// thuần không đủ để brute-force token. Không pepper → fallback sha256Hex
// để tương thích dữ liệu cũ (fail-closed ở prod qua warn ở boot).
export async function hashToken(value: string): Promise<string> {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper) return sha256Hex(value)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** True when a production-strength pepper is configured (≥32 chars). */
export function isTokenPepperConfigured(): boolean {
  return (process.env.TOKEN_PEPPER?.length ?? 0) >= 32
}
