import { error } from '@sveltejs/kit'
import { editionsOfScheme, pagesOfEdition } from '$lib/data/books'
import { renderForm, type RenderedForm, type SchemeBundle } from '$lib/data/forms'
import type { EntryRow, SightingRow } from '$lib/data/schema'
import { SCHEME_BY_ID } from '$lib/data/schemes'
import type { PageLoad } from './$types'

export interface PageEntryItem {
  entry: EntryRow
  bases: Array<{
    formId: string
    lang: string
    rendered: RenderedForm
  }>
  formRendered: RenderedForm
  sightings: SightingRow[]
}

export const load: PageLoad = async ({ params, url, fetch }) => {
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

  let pageEntries: PageEntryItem[] = []
  if (scheme.state !== 'listed') {
    const res = await fetch(`/data/scheme-${scheme.id}.json`)
    if (res.ok) {
      const bundle = (await res.json()) as SchemeBundle
      for (const entry of bundle.entries) {
        const entrySightings = (bundle.sightings[entry.id] ?? []).filter(
          (s) => s.edition === edition.id && s.page === seq,
        )
        if (entrySightings.length === 0) continue
        const bases = (bundle.bases[entry.id] ?? []).map((b) => ({
          formId: b.form,
          lang: b.lang,
          rendered: renderForm(bundle.forms[b.form]),
        }))
        pageEntries.push({
          entry,
          bases,
          formRendered: renderForm(bundle.forms[entry.form]),
          sightings: entrySightings,
        })
      }
    }
  }

  const initialEntry = url.searchParams.get('entry')

  return {
    scheme,
    edition,
    editions,
    page: pages[idx],
    pages,
    prevSeq: idx > 0 ? pages[idx - 1].seq : null,
    nextSeq: idx < pages.length - 1 ? pages[idx + 1].seq : null,
    pageEntries,
    initialEntry,
  }
}
