/**
 * Tiny RFC 4180-ish CSV parser. Accepts:
 *   - LF or CRLF row separators
 *   - Quoted fields, with "" as an escaped quote inside
 *   - Trailing newline (optional)
 * Does not accept: comments, multi-line fields, BOM stripping (caller
 * is responsible for stripping a leading \uFEFF if present).
 *
 * Returns rows of string cells. Empty rows are dropped.
 */

export interface ParseCsvResult {
  rows: string[][]
  errors: string[]
}

export function parseCsv(input: string): ParseCsvResult {
  const errors: string[] = []
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      field = ''
      if (ch === '\r' && input[i + 1] === '\n') i += 2
      else i += 1
      continue
    }
    field += ch
    i += 1
  }

  if (inQuotes) {
    errors.push(`Unterminated quoted field at end of input (near ${field.slice(-20)}).`)
    return { rows, errors }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }

  return { rows, errors }
}

export function rowsToObjects<T extends Record<string, string>>(rows: string[][]): T[] {
  if (rows.length === 0) return []
  const header = rows[0].map((c) => c.trim())
  const objects: T[] = []
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r]
    const obj: Record<string, string> = {}
    for (let c = 0; c < header.length; c += 1) {
      obj[header[c]] = (row[c] ?? '').trim()
    }
    objects.push(obj as T)
  }
  return objects
}
