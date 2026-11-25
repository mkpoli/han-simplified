import { describe, expect, test } from 'bun:test'
import { colorSchemeOf, isTheme, parseTheme, themeColorMedia } from './theme'

describe('theme helpers', () => {
  test('isTheme and parseTheme normalize unknown values to system', () => {
    expect(isTheme('system')).toBe(true)
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('sepia')).toBe(false)

    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('system')).toBe('system')
    expect(parseTheme('unknown')).toBe('system')
    expect(parseTheme(undefined)).toBe('system')
  })

  test('colorSchemeOf and themeColorMedia map each theme state', () => {
    expect(colorSchemeOf('system')).toBe('light dark')
    expect(colorSchemeOf('light')).toBe('light')
    expect(colorSchemeOf('dark')).toBe('dark')

    expect(themeColorMedia('system', 'light')).toBe('(prefers-color-scheme: light)')
    expect(themeColorMedia('system', 'dark')).toBe('(prefers-color-scheme: dark)')
    expect(themeColorMedia('light', 'light')).toBe('all')
    expect(themeColorMedia('light', 'dark')).toBe('not all')
    expect(themeColorMedia('dark', 'light')).toBe('not all')
    expect(themeColorMedia('dark', 'dark')).toBe('all')
  })
})
