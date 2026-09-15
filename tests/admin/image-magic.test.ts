import { describe, expect, it } from 'vitest'

import { magicMatches } from '@/lib/admin/image-upload-actions'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const gif = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(8)])
const webp = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii'), Buffer.alloc(2)])
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

describe('magicMatches (M2)', () => {
  it('accepts genuine image headers', () => {
    expect(magicMatches(png, 'image/png')).toBe(true)
    expect(magicMatches(jpeg, 'image/jpeg')).toBe(true)
    expect(magicMatches(gif, 'image/gif')).toBe(true)
    expect(magicMatches(webp, 'image/webp')).toBe(true)
  })

  it('rejects forged MIME (SVG/HTML labeled as png) and cross-type blobs', () => {
    expect(magicMatches(svg, 'image/png')).toBe(false)
    expect(magicMatches(svg, 'image/jpeg')).toBe(false)
    expect(magicMatches(png, 'image/jpeg')).toBe(false)
    expect(magicMatches(Buffer.alloc(4), 'image/png')).toBe(false)
    expect(magicMatches(png, 'image/svg+xml')).toBe(false)
  })
})
