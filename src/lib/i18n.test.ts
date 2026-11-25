import { describe, expect, test } from 'bun:test'
import { catalogues, isLocale, LOCALES, negotiate, translate } from './i18n'

describe('i18n', () => {
  test('isLocale recognises the six supported locales', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  test('negotiate prefers a valid cookie over Accept-Language', () => {
    expect(negotiate('ja', 'en-US,en;q=0.9')).toBe('ja')
    expect(negotiate('invalid', 'ja-JP,ja;q=0.9')).toBe('ja')
  })

  test('negotiate maps Chinese script and region tags', () => {
    expect(negotiate(undefined, 'zh-TW,zh;q=0.9')).toBe('zh-Hant')
    expect(negotiate(undefined, 'zh-HK,zh;q=0.8')).toBe('zh-Hant')
    expect(negotiate(undefined, 'zh-Hant-TW')).toBe('zh-Hant')
    expect(negotiate(undefined, 'zh-CN,zh;q=0.9')).toBe('zh-Hans')
    expect(negotiate(undefined, 'zh-SG')).toBe('zh-Hans')
    expect(negotiate(undefined, 'ko-KR,ko;q=0.9')).toBe('ko')
    expect(negotiate(undefined, 'vi-VN')).toBe('vi')
    expect(negotiate(undefined, 'de-DE,fr;q=0.8')).toBe('en')
    expect(negotiate(undefined, null)).toBe('en')
  })

  test('negotiate respects Accept-Language quality weights and q=0 exclusions', () => {
    expect(negotiate(undefined, 'ja;q=0,en;q=1')).toBe('en')
    expect(negotiate(undefined, 'en;q=0.1,ja;q=1')).toBe('ja')
    expect(negotiate(undefined, 'zh-TW;q=0.5,zh-CN;q=0.9')).toBe('zh-Hans')
    expect(negotiate(undefined, 'ko;q=0.8,vi;q=0.8')).toBe('ko')
    expect(negotiate(undefined, 'ja;q=0')).toBe('en')
  })

  test('every locale catalogue has the exact key set of en.json', () => {
    const baseKeys = Object.keys(catalogues.en).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(catalogues[locale]).sort()).toEqual(baseKeys)
      for (const key of baseKeys) {
        expect(catalogues[locale][key].trim().length).toBeGreaterThan(0)
      }
    }
  })

  test('translate interpolates placeholders and falls back to en then key', () => {
    expect(translate('zh-Hant', 'app.name')).toBe('簡化字譜')
    expect(translate('xx', 'app.name')).toBe('Simplified Han Compared')
    expect(translate('en', 'missing.key')).toBe('missing.key')
  })
})
