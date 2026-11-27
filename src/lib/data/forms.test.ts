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

  it('validates cn-1964 totals (352, 132, 14, 1754, 39, 146 rules) and cn-1935 (324, 鹽->𥂁)', () => {
    const { dataset, errors } = validateDataDir(DATA_DIR)
    expect(errors).toEqual([])

    expect(dataset.schemes.find((s) => s.id === 'cn-1964')?.state).toBe('checked')
    expect(dataset.schemes.find((s) => s.id === 'cn-1935')?.state).toBe('checked')

    const e64 = dataset.entries.filter((e) => e.scheme === 'cn-1964')
    expect(e64.filter((e) => e.section === 'table1').length).toBe(352)
    expect(e64.filter((e) => e.section === 'table2-chars').length).toBe(132)
    expect(e64.filter((e) => e.section === 'table2-components').length).toBe(14)
    expect(new Set(e64.filter((e) => e.section === 'table3').map((e) => e.form)).size).toBe(1754)
    expect(e64.filter((e) => e.section === 'appendix').length).toBe(39)
    expect(dataset.rules.filter((r) => r.scheme === 'cn-1964').length).toBe(146)

    const e35 = dataset.entries.filter((e) => e.scheme === 'cn-1935')
    expect(e35.length).toBe(324)

    // Known compilation floor check from PLAN.md: 1935 鹽 is 𥂁 (U+25081), not 盐
    const formById = new Map(dataset.forms.map((f) => [f.id, f]))
    const baseByEntry = new Map<string, string[]>()
    for (const b of dataset.entry_bases) {
      const list = baseByEntry.get(b.entry) ?? []
      list.push(formById.get(b.form)?.codepoint ?? '')
      baseByEntry.set(b.entry, list)
    }
    const yan1935 = e35.find((e) => (baseByEntry.get(e.id) ?? []).includes('U+9E7D'))
    expect(yan1935).toBeDefined()
    expect(formById.get(yan1935!.form)?.codepoint).toBe('U+25081')
  })

  it('validates jp-1949 full 1,850 inventory with unchanged entries stored explicitly', () => {
    const { dataset, errors } = validateDataDir(DATA_DIR)
    expect(errors).toEqual([])

    const jp = dataset.schemes.find((s) => s.id === 'jp-1949')
    expect(jp?.state).toBe('checked')
    expect(jp?.coverage).toBe('inventory')

    const entries = dataset.entries.filter((e) => e.scheme === 'jp-1949')
    expect(entries.length).toBe(1850)

    const formById = new Map(dataset.forms.map((f) => [f.id, f]))
    const baseByEntry = new Map<string, string[]>()
    for (const b of dataset.entry_bases) {
      const list = baseByEntry.get(b.entry) ?? []
      list.push(formById.get(b.form)?.codepoint ?? '')
      baseByEntry.set(b.entry, list)
    }

    // Unchanged entry (一) has empty entry_bases; simplified entry (国) records 國; 燈 retained in 1949
    const yi = entries.find((e) => formById.get(e.form)?.codepoint === 'U+4E00')
    expect(yi).toBeDefined()
    expect(baseByEntry.get(yi!.id) ?? []).toEqual([])

    const guo = entries.find((e) => formById.get(e.form)?.codepoint === 'U+56FD')
    expect(guo).toBeDefined()
    expect(baseByEntry.get(guo!.id)).toContain('U+570B')

    const deng = entries.find((e) => formById.get(e.form)?.codepoint === 'U+71C8')
    expect(deng).toBeDefined()
  })
})
