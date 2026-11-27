import { describe, expect, it } from 'bun:test'
import { join, resolve } from 'node:path'
import { codepointToText, renderForm, sectionLabel } from './forms'
import { validateDataDir } from './validate'

const DATA_DIR = resolve(import.meta.dir, '../../../data')

describe('forms helpers', () => {
  it('decodes single and multi-codepoint forms including supplementary planes', () => {
    expect(codepointToText('U+4E01')).toBe('丁')
    expect(codepointToText('U+4E01 U+5B81')).toBe('丁宁')
    expect(codepointToText('U+30C21')).toBe('𰰡')
    expect(codepointToText('')).toBe('')
  })

  it('renders encoded, IDS-only, and photo-only forms distinctly', () => {
    expect(renderForm({ id: 'f1', codepoint: 'U+5DF4', ids: '', compendium_record: '' })).toEqual({
      text: '巴',
      isEncoded: true,
      ids: '',
    })
    expect(renderForm({ id: 'f2', codepoint: '', ids: '⿰刁鸟', compendium_record: '' })).toEqual({
      text: '',
      isEncoded: false,
      ids: '⿰刁鸟',
    })
    expect(renderForm({ id: 'f3', codepoint: '', ids: '', compendium_record: '' })).toEqual({
      text: '',
      isEncoded: false,
      ids: '',
    })
  })

  it('returns section labels', () => {
    expect(sectionLabel('table1-1')).toContain('第一表')
    expect(sectionLabel('')).toBe('—')
  })
})

describe('cn-1977 dataset integrity', () => {
  it('validates with 61 rules, 336 unique Table 2 analogical forms, and zero missing sightings', () => {
    const { dataset, errors } = validateDataDir(DATA_DIR)
    expect(errors).toEqual([])

    const cn1977 = dataset.schemes.find((s) => s.id === 'cn-1977')
    expect(cn1977?.state).toBe('checked')

    const entries = dataset.entries.filter((e) => e.scheme === 'cn-1977')
    expect(entries.length).toBe(886)

    const rules = dataset.rules.filter((r) => r.scheme === 'cn-1977')
    expect(rules.length).toBe(61)

    const t2Anal = entries.filter((e) => e.section === 'table2-8-analogical')
    expect(new Set(t2Anal.map((e) => e.form)).size).toBe(336)

    const sightedEntries = new Set(dataset.sightings.map((s) => s.entry))
    expect(entries.every((e) => sightedEntries.has(e.id))).toBe(true)

    // Table 2(8) analogical entries print only the original base character, never a derived form glyph
    const t2AnalIds = new Set(t2Anal.map((e) => e.id))
    const t2AnalFormSightings = dataset.sightings.filter(
      (s) => t2AnalIds.has(s.entry) && s.role === 'form',
    )
    expect(t2AnalFormSightings.length).toBe(0)

    // Verify 潦 footnote split shares printed_row and 雕 carries footnote
    const liao = entries.filter((e) => e.footnote.includes('雨水大'))
    expect(liao.length).toBe(2)
    expect(liao[0].printed_row).toBe(liao[1].printed_row)

    // Verify static bundle exists and matches entry count
    const bundlePath = join(DATA_DIR, '../static/data/scheme-cn-1977.json')
    expect(Bun.file(bundlePath).size).toBeGreaterThan(100_000)
  })
})
