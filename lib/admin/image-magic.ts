/**
 * Magic-bytes verification for image uploads (M2) — pure sync helper.
 * Lives outside the 'use server' actions module: Server Action modules may
 * only export async functions, so a sync export here breaks `next build`
 * (Turbopack: "Server Actions must be async functions").
 */
export function magicMatches(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const jpeg = [0xff, 0xd8, 0xff]
  const gif87 = 'GIF87a'
  const gif89 = 'GIF89a'
  switch (mime) {
    case 'image/png':
      return png.every((b, i) => buffer[i] === b)
    case 'image/jpeg':
      return jpeg.every((b, i) => buffer[i] === b)
    case 'image/gif':
      return buffer.toString('ascii', 0, 6) === gif87 || buffer.toString('ascii', 0, 6) === gif89
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    default:
      return false
  }
}
