import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import manifest from './manifest.json'

const DIR = dirname(fileURLToPath(import.meta.url))

describe('pinned Glyph Atlas design tokens', () => {
  test('manifest pins a full commit SHA', () => {
    expect(manifest.repository).toBe('mkpoli/glyph-atlas')
    expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/)
  })

  test('every copied CSS file matches its manifest sha256 and byte length', () => {
    const entries = Object.entries(manifest.files)
    expect(entries.map(([name]) => name).sort()).toEqual(['base.css', 'components.css', 'tokens.css'])

    for (const [file, meta] of entries) {
      const content = readFileSync(join(DIR, file))
      const sha256 = createHash('sha256').update(content).digest('hex')
      expect(content.byteLength).toBe(meta.bytes)
      expect(sha256).toBe(meta.sha256)
    }
  })
})
