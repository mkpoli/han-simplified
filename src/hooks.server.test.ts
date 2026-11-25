import { describe, expect, test } from 'bun:test'
import { handle } from './hooks.server'

function makeEvent(
  path: string,
  options: { cookies?: Record<string, string>; acceptLanguage?: string } = {},
) {
  const url = new URL(`https://hans.glyphatlas.org${path}`)
  const headers = new Headers()
  if (options.acceptLanguage) headers.set('accept-language', options.acceptLanguage)
  const cookies = options.cookies ?? {}
  return {
    url,
    request: new Request(url, { headers }),
    cookies: { get: (name: string) => cookies[name] },
    locals: { theme: 'system', locale: 'en' },
  } as unknown as Parameters<typeof handle>[0]['event']
}

async function runResolve(
  path: string,
  options: { cookies?: Record<string, string>; acceptLanguage?: string } = {},
) {
  const event = makeEvent(path, options)
  const template =
    '<html lang="%lang%" data-theme="%theme%"><meta name="color-scheme" content="%colorScheme%" /><meta name="theme-color" media="%themeLightMedia%" /><meta name="theme-color" media="%themeDarkMedia%" /></html>'
  let transformed = template
  const response = await handle({
    event,
    resolve: async (_ev, opts) => {
      if (opts?.transformPageChunk) {
        transformed = String(await opts.transformPageChunk({ html: template, done: true }))
      }
      return new Response(transformed, { headers: { 'content-type': 'text/html' } })
    },
  })
  return { event, response, html: transformed }
}

describe('hooks.server handle', () => {
  test('redirects / to negotiated locale and preserves query string', async () => {
    try {
      await runResolve('/?q=藏', { acceptLanguage: 'zh-TW,zh;q=0.9' })
      expect.unreachable('should redirect')
    } catch (err: unknown) {
      expect(err).toMatchObject({ status: 302, location: '/zh-Hant?q=%E8%97%8F' })
    }
  })

  test('redirects unprefixed subpath using locale cookie', async () => {
    try {
      await runResolve('/schemes', { cookies: { 'hs.locale': 'ja' }, acceptLanguage: 'en-US' })
      expect.unreachable('should redirect')
    } catch (err: unknown) {
      expect(err).toMatchObject({ status: 302, location: '/ja/schemes' })
    }
  })

  test('keeps /design outside locale prefix and applies theme cookie', async () => {
    const { event, response, html } = await runResolve('/design', {
      cookies: { 'hs.theme': 'dark', 'hs.locale': 'zh-Hans' },
    })
    expect(response.status).toBe(200)
    expect(event.locals.theme).toBe('dark')
    expect(event.locals.locale).toBe('zh-Hans')
    expect(html).toContain('lang="en"')
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('content="dark"')
    expect(html).toContain('media="not all"')
    expect(html).toContain('media="all"')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('serves localized route with matching lang attribute', async () => {
    const { event, response, html } = await runResolve('/zh-Hant/schemes')
    expect(response.status).toBe(200)
    expect(event.locals.locale).toBe('zh-Hant')
    expect(html).toContain('lang="zh-Hant"')
    expect(html).toContain('content="light dark"')
  })
})
