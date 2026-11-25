import { redirect, type Handle } from '@sveltejs/kit'
import { isLocale, LOCALE_COOKIE, negotiate } from '$lib/i18n'
import { colorSchemeOf, parseTheme, THEME_COOKIE, themeColorMedia } from '$lib/theme'

const UNPREFIXED = /^\/(design(?:\/|$)|media\/|_app\/|robots\.txt$|favicon\.svg$)/

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname, search } = event.url
  const first = pathname.split('/')[1]

  if (!isLocale(first) && !UNPREFIXED.test(pathname)) {
    const locale = negotiate(
      event.cookies.get(LOCALE_COOKIE),
      event.request.headers.get('accept-language'),
    )
    redirect(302, `/${locale}${pathname === '/' ? '' : pathname}${search}`)
  }

  event.locals.locale = isLocale(first)
    ? first
    : negotiate(event.cookies.get(LOCALE_COOKIE), event.request.headers.get('accept-language'))
  event.locals.theme = parseTheme(event.cookies.get(THEME_COOKIE))

  const htmlLang = isLocale(first) ? first : 'en'
  const theme = event.locals.theme
  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%lang%', htmlLang)
        .replace('%theme%', theme)
        .replace('%colorScheme%', colorSchemeOf(theme))
        .replace('%themeLightMedia%', themeColorMedia(theme, 'light'))
        .replace('%themeDarkMedia%', themeColorMedia(theme, 'dark')),
  })

  response.headers.set('x-content-type-options', 'nosniff')
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  response.headers.set('x-frame-options', 'SAMEORIGIN')
  return response
}
