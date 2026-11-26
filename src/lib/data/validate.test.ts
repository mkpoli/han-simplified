import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import generatedSchemes from '../generated/schemes.json'
import { TABLE_COLUMNS } from './schema'
import { validateDataDir, validateTables, type RawTables } from './validate'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DATA_DIR = resolve(ROOT, 'data')

function emptyTables(): RawTables {
  const out = {} as RawTables
  for (const [key, cols] of Object.entries(TABLE_COLUMNS)) {
    out[key as keyof RawTables] = `${cols.join('\t')}\n`
  }
  return out
}

describe('repository data validation', () => {
  test('all TSV files in data/ pass schema and referential validation', () => {
    const { dataset, errors } = validateDataDir(DATA_DIR)
    expect(errors).toEqual([])
    expect(dataset.schemes.length).toBe(30)
  })

  test('generated schemes.json matches data/schemes.tsv', () => {
    const { dataset } = validateDataDir(DATA_DIR)
    expect(generatedSchemes).toEqual(dataset.schemes)
  })
})

describe('validator invariants', () => {
  test('rejects private-use code points in TSV content and form codepoints', () => {
    const raw = emptyTables()
    raw.forms += 'f1\tU+E001\t\t\n'
    raw.schemes += 'cn-1977\tcn\t1977\t二简\uE002\twithdrawn\tdiff\t文改会\t1977-12-20\t1986-06-24\t\tlisted\n'
    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('U+E001'))).toBe(true)
    expect(errors.some((e) => e.includes('U+E002'))).toBe(true)
  })

  test('rejects out-of-bounds sighting boxes and missing manifest image keys', () => {
    const raw = emptyTables()
    raw.schemes += 'cn-1977\tcn\t1977\t第二次汉字简化方案（草案）\twithdrawn\tdiff\t中国文字改革委员会\t1977-12-20\t1986-06-24\t\ttranscribed\n'
    raw.editions += 'ed-1\tcn-1977\tScan\t1977\tHolder\t\t\t2026-11-25\t\t\n'
    raw.pages += 'ed-1\t1\tp.1\tfull\t\t\t1000\t1500\tmissing-key\n'
    raw.forms += 'f1\tU+5DF4\t\t\n'
    raw.entries += 'e1\tcn-1977\tTable 1\t1\t1\tcharacter\tf1\t\t\tprint\tsame\n'
    raw.sightings += 'e1\ted-1\t1\tform\t1\t0.8\t0.2\t0.3\t0.1\n'
    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('missing-key'))).toBe(true)
    expect(errors.some((e) => e.includes('out of page bounds'))).toBe(true)
  })

  test('rejects unsourced links, unknown link targets, and replaces cycles', () => {
    const raw = emptyTables()
    raw.schemes +=
      'cn-1955-draft\tcn\t1955\tDraft\tdraft\tdiff\tBody\t\t\tcn-1956\tlisted\n' +
      'cn-1956\tcn\t1956\tScheme\tadopted\tdiff\tBody\t1956-01-28\t\tcn-1955-draft\tlisted\n'
    raw.links += 'f-missing\th-missing\tsimplification\t\t\t\t\n'
    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('cycle detected'))).toBe(true)
    expect(errors.some((e) => e.includes('unknown form "f-missing"'))).toBe(true)
    expect(errors.some((e) => e.includes('unknown head "h-missing"'))).toBe(true)
    expect(errors.some((e) => e.includes('link must name its source'))).toBe(true)
  })

  test('checks printed vs counted totals and checked scheme invariants', () => {
    const raw = emptyTables()
    raw.schemes += 'cn-1977\tcn\t1977\t第二次汉字简化方案（草案）\twithdrawn\tdiff\t中国文字改革委员会\t1977-12-20\t1986-06-24\t\tchecked\n'
    raw.forms += 'f1\tU+5DF4\t\t\n'
    raw.entries += 'e1\tcn-1977\tTable 1\t1\t1\tcharacter\tf1\t\t\tprint\tdifferent\n'
    raw.checks += 'cn-1977\tTable 1\tentries\t2\t1\t\n'
    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('unverified or differing entries'))).toBe(true)
    expect(errors.some((e) => e.includes('printed=2 != counted=1'))).toBe(true)
  })

  test('allows multi-codepoint word forms while rejecting PUA inside sequences', () => {
    const raw = emptyTables()
    raw.forms += 'f-dingning\tU+4E01 U+5B81\t\t\n'
    raw.forms += 'f-badword\tU+4E01 U+E001\t\t\n'
    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('U+4E01 U+5B81'))).toBe(false)
    expect(errors.some((e) => e.includes('U+E001'))).toBe(true)
  })

  test('rejects cross-scheme sightings, nonexistent base positions, and mismatched page image keys', () => {
    const sha = 'a'.repeat(64)
    const raw = emptyTables()
    raw.schemes +=
      'cn-1964\tcn\t1964\t简化字总表\tadopted\tdiff\t中国文字改革委员会\t1964-05\t\t\tlisted\n' +
      'cn-1977\tcn\t1977\t第二次汉字简化方案（草案）\twithdrawn\tdiff\t中国文字改革委员会\t1977-12-20\t1986-06-24\t\ttranscribed\n'
    raw.editions +=
      'ed-64\tcn-1964\t1964 scan\t1964\tHolder\t\t\t2026-11-26\t\t\n' +
      'ed-77\tcn-1977\t1977 scan\t1977\tHolder\t\t\t2026-11-26\t\t\n'
    raw.media_manifest +=
      `img-64-1\ted-64\t1\t${sha}\t1000\t1500\t320,1600\n` +
      `img-77-1\ted-77\t1\t${sha}\t1000\t1500\t320,1600\n`
    raw.pages +=
      'ed-64\t1\tp.1\tfull\t\t\t1000\t1500\timg-64-1\n' +
      'ed-77\t1\tp.1\tfull\t\t\t1000\t1500\timg-64-1\n'
    raw.forms += 'f-ba\tU+5DF4\t\t\n' + 'f-base\tU+82AD\t\t\n'
    raw.entries += 'e-77\tcn-1977\tTable 1\t1\t1\tcharacter\tf-ba\t\t\tprint\tsame\n'
    raw.entry_bases += 'e-77\t1\tf-base\tzh-Hans\n'
    raw.sightings +=
      'e-77\ted-64\t1\tform\t1\t0.1\t0.1\t0.1\t0.1\n' +
      'e-77\ted-77\t1\tbase\t99\t0.1\t0.1\t0.1\t0.1\n'

    const { errors } = validateTables(raw)
    expect(errors.some((e) => e.includes('belongs to page (ed-64, 1)'))).toBe(true)
    expect(errors.some((e) => e.includes('cannot cite edition "ed-64"'))).toBe(true)
    expect(errors.some((e) => e.includes('no matching entry_base'))).toBe(true)
  })
})
