import rawEditions from '$lib/generated/editions.json'
import rawPages from '$lib/generated/pages.json'
import type { EditionRow, PageRow } from './schema'

export const EDITIONS: readonly EditionRow[] = rawEditions as EditionRow[]
export const PAGES: readonly PageRow[] = rawPages as PageRow[]

export const EDITION_BY_ID: ReadonlyMap<string, EditionRow> = new Map(
  EDITIONS.map((ed) => [ed.id, ed]),
)

export function editionsOfScheme(schemeId: string): EditionRow[] {
  return EDITIONS.filter((ed) => ed.scheme === schemeId)
}

export function primaryEditionOf(schemeId: string): EditionRow | null {
  return editionsOfScheme(schemeId)[0] ?? null
}

export function pagesOfEdition(editionId: string): PageRow[] {
  return PAGES.filter((p) => p.edition === editionId).sort((a, b) => a.seq - b.seq)
}

export function pageCountOfScheme(schemeId: string): number {
  const ed = primaryEditionOf(schemeId)
  return ed ? pagesOfEdition(ed.id).length : 0
}
