import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, url }) => {
  void url.href
  return {
    theme: locals.theme,
    locale: locals.locale,
  }
}
