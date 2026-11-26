import { describe, expect, test } from 'bun:test'
import { GET } from './[...key]/+server'

const HASH = 'a'.repeat(64)

function makeEvent(key: string, objects: Record<string, { body: Uint8Array; httpEtag: string }>, ifNoneMatch?: string) {
  const headers = new Headers()
  if (ifNoneMatch) headers.set('if-none-match', ifNoneMatch)
  return {
    params: { key },
    request: new Request(`https://hans.glyphatlas.org/media/${key}`, { headers }),
    platform: {
      env: {
        MEDIA: {
          get: async (k: string) => objects[k] ?? null,
        },
      },
    },
  } as unknown as Parameters<typeof GET>[0]
}

describe('/media/[...key]', () => {
  test('rejects invalid keys with 404 no-store', async () => {
    const res = await GET(makeEvent('../secret.webp', {}))
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  test('serves allowed page WebP with immutable caching', async () => {
    const key = `pages/${HASH}/w1600.webp`
    const payload = new Uint8Array([82, 73, 70, 70])
    const res = await GET(makeEvent(key, { [key]: { body: payload, httpEtag: '"etag-1"' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('etag')).toBe('"etag-1"')
  })

  test('returns 304 when If-None-Match matches ETag', async () => {
    const key = `pages/${HASH}/w320.webp`
    const res = await GET(
      makeEvent(key, { [key]: { body: new Uint8Array([1]), httpEtag: '"etag-2"' } }, '"etag-2"'),
    )
    expect(res.status).toBe(304)
  })
})
