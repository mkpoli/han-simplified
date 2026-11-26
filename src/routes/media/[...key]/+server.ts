import type { RequestHandler } from './$types'

const ALLOWED_KEY =
  /^(?:pages\/[0-9a-f]{64}\/(?:w320|w1600|full)|sheets\/[0-9a-f]{64})\.webp$/

const NOT_FOUND = () =>
  new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })

function normalizeWeakEtag(tag: string): string {
  return tag.trim().replace(/^W\//, '')
}

function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false
  const trimmed = header.trim()
  if (trimmed === '*') return true
  const target = normalizeWeakEtag(etag)
  return trimmed
    .split(',')
    .map((part) => normalizeWeakEtag(part))
    .some((candidate) => candidate === target)
}

export const GET: RequestHandler = async ({ params, platform, request }) => {
  const key = params.key
  if (!key || !ALLOWED_KEY.test(key)) return NOT_FOUND()

  const bucket = platform?.env.MEDIA
  if (!bucket) return NOT_FOUND()

  const object = await bucket.get(key)
  if (!object) return NOT_FOUND()

  const headers = new Headers({
    'content-type': 'image/webp',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  if (object.httpEtag) {
    headers.set('etag', object.httpEtag)
    if (matchesIfNoneMatch(request.headers.get('if-none-match'), object.httpEtag)) {
      return new Response(null, { status: 304, headers })
    }
  }

  return new Response(object.body, { headers })
}
