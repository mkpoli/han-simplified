export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_COOKIE = 'hs.theme'
export const THEME_STORAGE_KEY = 'hs.theme'

export const isTheme = (value: string | undefined | null): value is Theme =>
  THEMES.includes(value as Theme)

export const parseTheme = (value: string | undefined | null): Theme =>
  value === 'light' || value === 'dark' ? value : 'system'

export const colorSchemeOf = (value: Theme): 'light dark' | 'light' | 'dark' =>
  value === 'system' ? 'light dark' : value

export const themeColorMedia = (value: Theme, scheme: 'light' | 'dark'): string =>
  value === 'system' ? `(prefers-color-scheme: ${scheme})` : value === scheme ? 'all' : 'not all'

export function applyThemeToDocument(value: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = value
  const schemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
  if (schemeMeta) schemeMeta.content = colorSchemeOf(value)
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-scheme]')) {
    const scheme = meta.dataset.scheme
    if (scheme === 'light' || scheme === 'dark') {
      meta.media = themeColorMedia(value, scheme)
    }
  }
}

export function setTheme(value: Theme): void {
  if (!isTheme(value)) return
  applyThemeToDocument(value)
  if (typeof document !== 'undefined') {
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
  }
  try {
    if (typeof localStorage !== 'undefined') {
      if (value === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, value)
    }
  } catch {
    // Storage may be blocked; the cookie and live document state still apply.
  }
}

export function readStoredTheme(): Theme | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === null) return null
    return parseTheme(stored)
  } catch {
    return null
  }
}
