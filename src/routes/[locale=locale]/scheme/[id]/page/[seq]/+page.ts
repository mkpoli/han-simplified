import { error } from '@sveltejs/kit'
import { editionsOfScheme, pagesOfEdition } from '$lib/data/books'
import { SCHEME_BY_ID } from '$lib/data/schemes'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, url }) => {
  const scheme = SCHEME_BY_ID.get(params.id)
  if (!scheme) error(404, 'Scheme not found')

  const editions = editionsOfScheme(scheme.id)
  const requestedEdition = url.searchParams.get('edition')
  const edition =
    (requestedEdition ? editions.find((ed) => ed.id === requestedEdition) : null) ??
    editions[0] ??
    null
  if (!edition) error(404, 'Edition not found')

  const pages = pagesOfEdition(edition.id)
  const seq = Number(params.seq)
  if (!Number.isInteger(seq) || seq < 1) error(404, 'Invalid page number')

  const idx = pages.findIndex((p) => p.seq === seq)
  if (idx < 0) error(404, 'Page not found')

  return {
    scheme,
    edition,
    editions,
    page: pages[idx],
    pages,
    prevSeq: idx > 0 ? pages[idx - 1].seq : null,
    nextSeq: idx < pages.length - 1 ? pages[idx + 1].seq : null,
  }
}
