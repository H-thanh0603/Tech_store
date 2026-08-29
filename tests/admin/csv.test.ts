import { describe, expect, it } from 'vitest'

import { parseCsv, rowsToObjects } from '@/lib/admin/csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    const csv = 'name,slug\niPhone 15,iphone-15\nPixel 9,pixel-9\n'
    const { rows, errors } = parseCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      ['name', 'slug'],
      ['iPhone 15', 'iphone-15'],
      ['Pixel 9', 'pixel-9'],
    ])
  })

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n'
    const { rows, errors } = parseCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('handles quoted fields with commas', () => {
    const csv = 'name,note\n"Acme, Inc.","hello, world"\nplain,no-quote\n'
    const { rows, errors } = parseCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      ['name', 'note'],
      ['Acme, Inc.', 'hello, world'],
      ['plain', 'no-quote'],
    ])
  })

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'name\n"He said ""hi"""\n'
    const { rows, errors } = parseCsv(csv)
    expect(errors).toEqual([])
    expect(rows[1]).toEqual(['He said "hi"'])
  })

  it('reports unterminated quoted fields', () => {
    const csv = 'name\n"unterminated\n'
    const { errors } = parseCsv(csv)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/Unterminated/)
  })

  it('drops empty lines', () => {
    const csv = 'a,b\n\n1,2\n\n'
    const { rows } = parseCsv(csv)
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('rowsToObjects maps headers to values', () => {
    const { rows } = parseCsv('name,slug\niPhone,iphone\n')
    const out = rowsToObjects<{ name: string; slug: string }>(rows)
    expect(out).toEqual([{ name: 'iPhone', slug: 'iphone' }])
  })

  it('rowsToObjects trims cell whitespace', () => {
    const { rows } = parseCsv('name,slug\n  iPhone  ,  iphone  \n')
    const out = rowsToObjects<{ name: string; slug: string }>(rows)
    expect(out[0]).toEqual({ name: 'iPhone', slug: 'iphone' })
  })
})
