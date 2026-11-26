import { error } from '@sveltejs/kit'
import { editionsOfScheme, pagesOfEdition } from '$lib/data/books'
import { REPLACED_BY, SCHEME_BY_ID } from '$lib/data/schemes'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params }) => {
  const scheme = SCHEME_BY_ID.get(params.id)
  if (!scheme) error(404, 'Scheme not found')

  const editions = editionsOfScheme(scheme.id)
  const primary = editions[0] ?? null
  const pages = primary ? pagesOfEdition(primary.id) : []
  const successors = REPLACED_BY.get(scheme.id) ?? []

  return {
    scheme,
    editions,
    primary,
    pages,
    successors,
  }
}
