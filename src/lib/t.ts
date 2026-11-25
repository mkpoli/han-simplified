import { page } from '$app/state'
import { isLocale, translate, type Locale, type MessageKey } from './i18n'

export const locale = (): Locale => (isLocale(page.params.locale) ? page.params.locale : 'en')

export const t = (
  key: MessageKey | `${string}.${string}`,
  values?: Record<string, string | number>,
): string => translate(locale(), key, values)

export const href = (path = ''): string => `/${locale()}${path}`
