import rawChecks from '$lib/generated/checks.json'
import rawEditions from '$lib/generated/editions.json'
import rawPageEntryCounts from '$lib/generated/page-entry-counts.json'
import rawPages from '$lib/generated/pages.json'
import type { CheckRow, EditionRow, PageRow } from './schema'

export const EDITIONS: readonly EditionRow[] = rawEditions as EditionRow[]
export const PAGES: readonly PageRow[] = rawPages as PageRow[]
export const CHECKS: readonly CheckRow[] = rawChecks as CheckRow[]
export const PAGE_ENTRY_COUNTS: Readonly<Record<string, number>> =
  rawPageEntryCounts as Record<string, number>

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

export function checksOfScheme(schemeId: string): CheckRow[] {
  return CHECKS.filter((c) => c.scheme === schemeId)
}

export function pageEntryCount(editionId: string, seq: number): number {
  return PAGE_ENTRY_COUNTS[`${editionId}#${seq}`] ?? 0
}
