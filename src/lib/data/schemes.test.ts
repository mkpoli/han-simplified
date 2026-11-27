import { describe, expect, test } from 'bun:test'
import {
  filterSchemes,
  groupSchemesByCountry,
  REPLACED_BY,
  SCHEME_BY_ID,
  SCHEMES,
} from './schemes'
import { schemeLang } from './schema'

describe('schemes index helpers', () => {
  test('contains all 30 schemes grouped across five countries', () => {
    expect(SCHEMES.length).toBe(30)
    const groups = groupSchemesByCountry(SCHEMES)
    expect(groups.map((g) => [g.country, g.schemes.length])).toEqual([
      ['cn', 13],
      ['jp', 11],
      ['kr', 2],
      ['sg', 3],
      ['my', 1],
    ])
  })

  test('computes reverse replaces links accurately', () => {
    expect(REPLACED_BY.get('jp-1946')?.map((s) => s.id)).toEqual(['jp-1981'])
    expect(REPLACED_BY.get('jp-1949')?.map((s) => s.id)).toEqual(['jp-1981'])
    expect(REPLACED_BY.get('cn-1964')?.map((s) => s.id)).toEqual(['cn-1986'])
    expect(SCHEME_BY_ID.get('cn-1977')?.withdrawn_on).toBe('1986-06-24')
  })

  test('filters by country and state', () => {
    expect(filterSchemes(SCHEMES, { country: 'sg' }).length).toBe(3)
    const checked = filterSchemes(SCHEMES, { state: 'checked' })
    const transcribed = filterSchemes(SCHEMES, { state: 'transcribed' })
    const listed = filterSchemes(SCHEMES, { state: 'listed' })
    expect(checked.some((s) => s.id === 'cn-1977')).toBe(true)
    expect(checked.length + transcribed.length + listed.length).toBe(30)
  })

  test('picks regional lang tags for each scheme', () => {
    expect(schemeLang({ country: 'cn', year: 1935 })).toBe('zh-Hant')
    expect(schemeLang({ country: 'cn', year: 1964 })).toBe('zh-Hans')
    expect(schemeLang({ country: 'jp', year: 1949 })).toBe('ja')
    expect(schemeLang({ country: 'kr', year: 1967 })).toBe('ko')
    expect(schemeLang({ country: 'sg', year: 1969 })).toBe('zh-Hans')
  })
})
