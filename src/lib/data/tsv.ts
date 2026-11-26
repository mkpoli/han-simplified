export interface ParsedTsv {
  header: string[]
  rows: Array<{ line: number; values: Record<string, string> }>
  errors: string[]
}

export function isPrivateUseCodePoint(cp: number): boolean {
  return (
    (cp >= 0xe000 && cp <= 0xf8ff) ||
    (cp >= 0xf0000 && cp <= 0xffffd) ||
    (cp >= 0x100000 && cp <= 0x10fffd)
  )
}

export function findPrivateUse(text: string): Array<{ index: number; codePoint: string }> {
  const hits: Array<{ index: number; codePoint: string }> = []
  let index = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (isPrivateUseCodePoint(cp)) {
      hits.push({ index, codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}` })
    }
    index += ch.length
  }
  return hits
}

export function parseTsv(
  fileName: string,
  content: string,
  expectedColumns: readonly string[],
): ParsedTsv {
  const errors: string[] = []
  if (content.includes('\r')) {
    errors.push(`${fileName}: must use LF line endings, not CRLF`)
  }

  const puaHits = findPrivateUse(content)
  for (const hit of puaHits.slice(0, 5)) {
    errors.push(`${fileName}: private-use code point ${hit.codePoint} is forbidden`)
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const rawLines = normalized.split('\n')
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop()
  }

  if (rawLines.length === 0) {
    errors.push(`${fileName}: empty file (missing header row)`)
    return { header: [], rows: [], errors }
  }

  const header = rawLines[0].split('\t')
  if (
    header.length !== expectedColumns.length ||
    header.some((col, i) => col !== expectedColumns[i])
  ) {
    errors.push(
      `${fileName}:1: header mismatch; expected [${expectedColumns.join(', ')}], got [${header.join(', ')}]`,
    )
    return { header, rows: [], errors }
  }

  const rows: Array<{ line: number; values: Record<string, string> }> = []
  for (let i = 1; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const line = i + 1
    if (raw === '') {
      errors.push(`${fileName}:${line}: blank line inside TSV`)
      continue
    }
    const cells = raw.split('\t')
    if (cells.length !== expectedColumns.length) {
      errors.push(
        `${fileName}:${line}: expected ${expectedColumns.length} columns, got ${cells.length}`,
      )
      continue
    }
    const values: Record<string, string> = {}
    for (let c = 0; c < expectedColumns.length; c++) {
      values[expectedColumns[c]] = cells[c]
    }
    rows.push({ line, values })
  }

  return { header, rows, errors }
}
