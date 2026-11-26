import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHECK_METRICS,
  CHECK_VERDICTS,
  COUNTRIES,
  ENTRY_KINDS,
  ENTRY_ORIGINS,
  LINK_RELATIONS,
  PAGE_SIDES,
  SCHEME_COVERAGES,
  SCHEME_KINDS,
  SCHEME_STATES,
  SIGHTING_ROLES,
  TABLE_COLUMNS,
  TABLE_FILES,
  type CheckMetric,
  type CheckRow,
  type CheckVerdict,
  type Country,
  type Dataset,
  type EditionRow,
  type EntryBaseRow,
  type EntryKind,
  type EntryOrigin,
  type EntryRow,
  type FormRow,
  type HeadRow,
  type LinkRelation,
  type LinkRow,
  type MediaManifestRow,
  type PageRow,
  type PageSide,
  type RuleRow,
  type SchemeCoverage,
  type SchemeKind,
  type SchemeRow,
  type SchemeState,
  type SightingRole,
  type SightingRow,
} from './schema'
import { isPrivateUseCodePoint, parseTsv } from './tsv'

const SCHEME_ID_RE = /^(cn|jp|kr|sg|my)-(\d{4})(?:-[a-z0-9-]+)?$/
const ISO_PARTIAL_DATE_RE = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/
const SHA256_RE = /^[0-9a-f]{64}$/
const CODEPOINT_RE = /^U\+([0-9A-F]{4,6})$/
const BCP47_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/

export type RawTables = Record<keyof typeof TABLE_COLUMNS, string>

export interface ValidationResult {
  dataset: Dataset
  errors: string[]
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

function parseIntStrict(raw: string): number | null {
  if (!/^-?\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

function parseFloatStrict(raw: string): number | null {
  if (raw.trim() === '' || raw.trim() !== raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function isValidCalendarDate(iso: string): boolean {
  if (!ISO_PARTIAL_DATE_RE.test(iso)) return false
  const parts = iso.split('-').map(Number)
  if (parts.length < 3) return true
  const [y, m, d] = parts
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function loadRawTables(dataDir: string): RawTables {
  const out = {} as RawTables
  for (const key of Object.keys(TABLE_FILES) as Array<keyof typeof TABLE_FILES>) {
    out[key] = readFileSync(join(dataDir, TABLE_FILES[key]), 'utf8')
  }
  return out
}

export function validateTables(raw: RawTables): ValidationResult {
  const errors: string[] = []
  const dataset: Dataset = {
    schemes: [],
    editions: [],
    pages: [],
    entries: [],
    entry_bases: [],
    sightings: [],
    forms: [],
    heads: [],
    links: [],
    rules: [],
    checks: [],
    media_manifest: [],
  }

  // 1. schemes.tsv
  const schemesParsed = parseTsv(TABLE_FILES.schemes, raw.schemes, TABLE_COLUMNS.schemes)
  errors.push(...schemesParsed.errors)
  const schemeIds = new Set<string>()
  for (const { line, values: v } of schemesParsed.rows) {
    const loc = `${TABLE_FILES.schemes}:${line}`
    const idMatch = v.id.match(SCHEME_ID_RE)
    if (!idMatch) {
      errors.push(`${loc}: invalid scheme id "${v.id}"`)
    } else if (schemeIds.has(v.id)) {
      errors.push(`${loc}: duplicate scheme id "${v.id}"`)
    } else {
      schemeIds.add(v.id)
    }

    if (!isOneOf(v.country, COUNTRIES)) {
      errors.push(`${loc}: invalid country "${v.country}"`)
    } else if (idMatch && idMatch[1] !== v.country) {
      errors.push(`${loc}: scheme id "${v.id}" does not match country "${v.country}"`)
    }

    const year = parseIntStrict(v.year)
    if (year === null || year < 1900 || year > 2100) {
      errors.push(`${loc}: invalid year "${v.year}"`)
    } else if (idMatch && Number(idMatch[2]) !== year) {
      errors.push(`${loc}: scheme id "${v.id}" does not match year ${year}`)
    }

    if (!v.title.trim()) errors.push(`${loc}: empty title`)
    if (!isOneOf(v.kind, SCHEME_KINDS)) errors.push(`${loc}: invalid kind "${v.kind}"`)
    if (!isOneOf(v.coverage, SCHEME_COVERAGES)) errors.push(`${loc}: invalid coverage "${v.coverage}"`)
    if (!v.body.trim()) errors.push(`${loc}: empty body`)
    if (!isOneOf(v.state, SCHEME_STATES)) errors.push(`${loc}: invalid state "${v.state}"`)

    if (v.adopted_on && !isValidCalendarDate(v.adopted_on)) {
      errors.push(`${loc}: invalid adopted_on date "${v.adopted_on}"`)
    }
    if (v.withdrawn_on && !isValidCalendarDate(v.withdrawn_on)) {
      errors.push(`${loc}: invalid withdrawn_on date "${v.withdrawn_on}"`)
    }
    if (v.adopted_on && v.withdrawn_on && v.withdrawn_on < v.adopted_on) {
      errors.push(`${loc}: withdrawn_on "${v.withdrawn_on}" precedes adopted_on "${v.adopted_on}"`)
    }
    if (v.kind === 'withdrawn' && !v.withdrawn_on) {
      errors.push(`${loc}: withdrawn scheme must record withdrawn_on`)
    }

    const replaces = v.replaces ? v.replaces.split(',').map((s) => s.trim()).filter(Boolean) : []
    dataset.schemes.push({
      id: v.id,
      country: (isOneOf(v.country, COUNTRIES) ? v.country : 'cn') as Country,
      year: year ?? 0,
      title: v.title,
      kind: (isOneOf(v.kind, SCHEME_KINDS) ? v.kind : 'draft') as SchemeKind,
      coverage: (isOneOf(v.coverage, SCHEME_COVERAGES) ? v.coverage : 'diff') as SchemeCoverage,
      body: v.body,
      adopted_on: v.adopted_on,
      withdrawn_on: v.withdrawn_on,
      replaces,
      state: (isOneOf(v.state, SCHEME_STATES) ? v.state : 'listed') as SchemeState,
    })
  }

  // Validate scheme `replaces` references and acyclicity
  const schemeMap = new Map(dataset.schemes.map((s) => [s.id, s]))
  for (const s of dataset.schemes) {
    for (const target of s.replaces) {
      if (target === s.id) {
        errors.push(`${TABLE_FILES.schemes}: scheme "${s.id}" cannot replace itself`)
      } else if (!schemeIds.has(target)) {
        errors.push(`${TABLE_FILES.schemes}: scheme "${s.id}" replaces unknown scheme "${target}"`)
      }
    }
  }
  const visitState = new Map<string, 'visiting' | 'done'>()
  function checkCycle(id: string) {
    visitState.set(id, 'visiting')
    const node = schemeMap.get(id)
    for (const next of node?.replaces ?? []) {
      if (!schemeMap.has(next)) continue
      const st = visitState.get(next)
      if (st === 'visiting') {
        errors.push(`${TABLE_FILES.schemes}: cycle detected in replaces chain involving "${id}" -> "${next}"`)
      } else if (!st) {
        checkCycle(next)
      }
    }
    visitState.set(id, 'done')
  }
  for (const s of dataset.schemes) {
    if (!visitState.has(s.id)) checkCycle(s.id)
  }

  // 2. editions.tsv
  const editionsParsed = parseTsv(TABLE_FILES.editions, raw.editions, TABLE_COLUMNS.editions)
  errors.push(...editionsParsed.errors)
  const editionIds = new Set<string>()
  const editionScheme = new Map<string, string>()
  for (const { line, values: v } of editionsParsed.rows) {
    const loc = `${TABLE_FILES.editions}:${line}`
    if (!v.id.trim()) errors.push(`${loc}: empty edition id`)
    else if (editionIds.has(v.id)) errors.push(`${loc}: duplicate edition id "${v.id}"`)
    else {
      editionIds.add(v.id)
      editionScheme.set(v.id, v.scheme)
    }

    if (!schemeIds.has(v.scheme)) errors.push(`${loc}: unknown scheme "${v.scheme}"`)
    if (v.retrieved_on && !isValidCalendarDate(v.retrieved_on)) {
      errors.push(`${loc}: invalid retrieved_on "${v.retrieved_on}"`)
    }
    if (v.sha256 && !SHA256_RE.test(v.sha256)) {
      errors.push(`${loc}: invalid sha256 "${v.sha256}"`)
    }
    dataset.editions.push({
      id: v.id,
      scheme: v.scheme,
      title: v.title,
      imprint: v.imprint,
      holder: v.holder,
      source_url: v.source_url,
      supplied_by: v.supplied_by,
      retrieved_on: v.retrieved_on,
      sha256: v.sha256,
      note: v.note,
    })
  }

  // 3. media-manifest.tsv (parsed before pages so pages can validate image_key ownership)
  const mediaParsed = parseTsv(
    TABLE_FILES.media_manifest,
    raw.media_manifest,
    TABLE_COLUMNS.media_manifest,
  )
  errors.push(...mediaParsed.errors)
  const mediaByKey = new Map<string, MediaManifestRow>()
  for (const { line, values: v } of mediaParsed.rows) {
    const loc = `${TABLE_FILES.media_manifest}:${line}`
    if (!v.image_key.trim()) errors.push(`${loc}: empty image_key`)
    else if (mediaByKey.has(v.image_key)) errors.push(`${loc}: duplicate image_key "${v.image_key}"`)

    if (!editionIds.has(v.edition)) errors.push(`${loc}: unknown edition "${v.edition}"`)
    const page = parseIntStrict(v.page)
    if (page === null || page < 1) errors.push(`${loc}: invalid page "${v.page}"`)
    if (!SHA256_RE.test(v.sha256)) errors.push(`${loc}: invalid sha256 "${v.sha256}"`)
    const width = parseIntStrict(v.width)
    const height = parseIntStrict(v.height)
    if (width === null || width < 1) errors.push(`${loc}: invalid width "${v.width}"`)
    if (height === null || height < 1) errors.push(`${loc}: invalid height "${v.height}"`)
    const widths = v.widths
      ? v.widths.split(',').map((w) => parseIntStrict(w.trim())).filter((n): n is number => n !== null && n > 0)
      : []
    if (v.widths && widths.length !== v.widths.split(',').length) {
      errors.push(`${loc}: invalid widths "${v.widths}"`)
    }

    const row: MediaManifestRow = {
      image_key: v.image_key,
      edition: v.edition,
      page: page ?? 0,
      sha256: v.sha256,
      width: width ?? 0,
      height: height ?? 0,
      widths,
    }
    if (v.image_key.trim() && !mediaByKey.has(v.image_key)) mediaByKey.set(v.image_key, row)
    dataset.media_manifest.push(row)
  }

  // 4. pages.tsv
  const pagesParsed = parseTsv(TABLE_FILES.pages, raw.pages, TABLE_COLUMNS.pages)
  errors.push(...pagesParsed.errors)
  const pageKeys = new Set<string>()
  for (const { line, values: v } of pagesParsed.rows) {
    const loc = `${TABLE_FILES.pages}:${line}`
    if (!editionIds.has(v.edition)) errors.push(`${loc}: unknown edition "${v.edition}"`)
    const seq = parseIntStrict(v.seq)
    if (seq === null || seq < 1) errors.push(`${loc}: invalid seq "${v.seq}"`)
    const pk = `${v.edition}#${seq}`
    if (pageKeys.has(pk)) errors.push(`${loc}: duplicate page (${v.edition}, ${seq})`)
    else pageKeys.add(pk)

    if (!isOneOf(v.side, PAGE_SIDES)) errors.push(`${loc}: invalid side "${v.side}"`)
    if (v.raw_sha256 && !SHA256_RE.test(v.raw_sha256)) {
      errors.push(`${loc}: invalid raw_sha256 "${v.raw_sha256}"`)
    }
    const width = parseIntStrict(v.width)
    const height = parseIntStrict(v.height)
    if (width === null || width < 1) errors.push(`${loc}: invalid width "${v.width}"`)
    if (height === null || height < 1) errors.push(`${loc}: invalid height "${v.height}"`)
    if (v.image_key) {
      const media = mediaByKey.get(v.image_key)
      if (!media) {
        errors.push(`${loc}: image_key "${v.image_key}" missing from ${TABLE_FILES.media_manifest}`)
      } else if (media.edition !== v.edition || media.page !== seq) {
        errors.push(
          `${loc}: image_key "${v.image_key}" belongs to page (${media.edition}, ${media.page}), not (${v.edition}, ${seq})`,
        )
      }
    }

    dataset.pages.push({
      edition: v.edition,
      seq: seq ?? 0,
      printed_label: v.printed_label,
      side: (isOneOf(v.side, PAGE_SIDES) ? v.side : 'full') as PageSide,
      raw_sha256: v.raw_sha256,
      transform: v.transform,
      width: width ?? 0,
      height: height ?? 0,
      image_key: v.image_key,
    })
  }

  // Cross-check media-manifest pages exist in pages.tsv
  for (const m of dataset.media_manifest) {
    if (!pageKeys.has(`${m.edition}#${m.page}`)) {
      errors.push(
        `${TABLE_FILES.media_manifest}: image_key "${m.image_key}" references missing page (${m.edition}, ${m.page})`,
      )
    }
  }

  // 5. forms.tsv
  const formsParsed = parseTsv(TABLE_FILES.forms, raw.forms, TABLE_COLUMNS.forms)
  errors.push(...formsParsed.errors)
  const formIds = new Set<string>()
  const codepoints = new Set<string>()
  for (const { line, values: v } of formsParsed.rows) {
    const loc = `${TABLE_FILES.forms}:${line}`
    if (!v.id.trim()) errors.push(`${loc}: empty form id`)
    else if (formIds.has(v.id)) errors.push(`${loc}: duplicate form id "${v.id}"`)
    else formIds.add(v.id)

    if (v.codepoint) {
      const parts = v.codepoint.split(' ')
      let allValid = parts.length > 0
      for (const part of parts) {
        const m = part.match(CODEPOINT_RE)
        if (!m) {
          errors.push(`${loc}: invalid codepoint "${v.codepoint}"`)
          allValid = false
          break
        }
        const cp = Number.parseInt(m[1], 16)
        if (cp > 0x10ffff || isPrivateUseCodePoint(cp)) {
          errors.push(`${loc}: disallowed or private-use codepoint "${part}"`)
          allValid = false
          break
        }
      }
      if (allValid) {
        if (codepoints.has(v.codepoint)) {
          errors.push(`${loc}: duplicate codepoint "${v.codepoint}"`)
        } else {
          codepoints.add(v.codepoint)
        }
      }
    }

    dataset.forms.push({
      id: v.id,
      codepoint: v.codepoint,
      ids: v.ids,
      compendium_record: v.compendium_record,
    })
  }

  // 6. heads.tsv
  const headsParsed = parseTsv(TABLE_FILES.heads, raw.heads, TABLE_COLUMNS.heads)
  errors.push(...headsParsed.errors)
  const headIds = new Set<string>()
  for (const { line, values: v } of headsParsed.rows) {
    const loc = `${TABLE_FILES.heads}:${line}`
    if (!v.id.trim()) errors.push(`${loc}: empty head id`)
    else if (headIds.has(v.id)) errors.push(`${loc}: duplicate head id "${v.id}"`)
    else headIds.add(v.id)

    if (!formIds.has(v.form)) errors.push(`${loc}: unknown form "${v.form}"`)
    if (!isOneOf(v.kind, ENTRY_KINDS)) errors.push(`${loc}: invalid kind "${v.kind}"`)

    dataset.heads.push({
      id: v.id,
      form: v.form,
      kind: (isOneOf(v.kind, ENTRY_KINDS) ? v.kind : 'character') as EntryKind,
    })
  }

  // 7. entries.tsv
  const entriesParsed = parseTsv(TABLE_FILES.entries, raw.entries, TABLE_COLUMNS.entries)
  errors.push(...entriesParsed.errors)
  const entryIds = new Set<string>()
  const entryScheme = new Map<string, string>()
  for (const { line, values: v } of entriesParsed.rows) {
    const loc = `${TABLE_FILES.entries}:${line}`
    if (!v.id.trim()) errors.push(`${loc}: empty entry id`)
    else if (entryIds.has(v.id)) errors.push(`${loc}: duplicate entry id "${v.id}"`)
    else {
      entryIds.add(v.id)
      entryScheme.set(v.id, v.scheme)
    }

    if (!schemeIds.has(v.scheme)) errors.push(`${loc}: unknown scheme "${v.scheme}"`)
    const order = parseIntStrict(v.order)
    if (order === null || order < 1) errors.push(`${loc}: invalid order "${v.order}"`)
    if (!isOneOf(v.kind, ENTRY_KINDS)) errors.push(`${loc}: invalid kind "${v.kind}"`)
    if (!formIds.has(v.form)) errors.push(`${loc}: unknown form "${v.form}"`)
    if (!isOneOf(v.origin, ENTRY_ORIGINS)) errors.push(`${loc}: invalid origin "${v.origin}"`)
    if (!isOneOf(v.check, CHECK_VERDICTS)) errors.push(`${loc}: invalid check "${v.check}"`)

    dataset.entries.push({
      id: v.id,
      scheme: v.scheme,
      section: v.section,
      order: order ?? 0,
      printed_row: v.printed_row,
      kind: (isOneOf(v.kind, ENTRY_KINDS) ? v.kind : 'character') as EntryKind,
      form: v.form,
      condition: v.condition,
      footnote: v.footnote,
      origin: (isOneOf(v.origin, ENTRY_ORIGINS) ? v.origin : 'print') as EntryOrigin,
      check: (isOneOf(v.check, CHECK_VERDICTS) ? v.check : '') as CheckVerdict,
    })
  }

  // 8. entry_bases.tsv
  const basesParsed = parseTsv(
    TABLE_FILES.entry_bases,
    raw.entry_bases,
    TABLE_COLUMNS.entry_bases,
  )
  errors.push(...basesParsed.errors)
  const entryBaseKeys = new Set<string>()
  for (const { line, values: v } of basesParsed.rows) {
    const loc = `${TABLE_FILES.entry_bases}:${line}`
    if (!entryIds.has(v.entry)) errors.push(`${loc}: unknown entry "${v.entry}"`)
    const pos = parseIntStrict(v.pos)
    if (pos === null || pos < 1) errors.push(`${loc}: invalid pos "${v.pos}"`)
    const key = `${v.entry}#${pos}`
    if (entryBaseKeys.has(key)) errors.push(`${loc}: duplicate entry_base (${v.entry}, ${pos})`)
    else entryBaseKeys.add(key)

    if (!formIds.has(v.form)) errors.push(`${loc}: unknown form "${v.form}"`)
    if (v.lang && !BCP47_RE.test(v.lang)) errors.push(`${loc}: invalid lang "${v.lang}"`)

    dataset.entry_bases.push({
      entry: v.entry,
      pos: pos ?? 0,
      form: v.form,
      lang: v.lang,
    })
  }

  // 9. sightings.tsv
  const sightingsParsed = parseTsv(
    TABLE_FILES.sightings,
    raw.sightings,
    TABLE_COLUMNS.sightings,
  )
  errors.push(...sightingsParsed.errors)
  for (const { line, values: v } of sightingsParsed.rows) {
    const loc = `${TABLE_FILES.sightings}:${line}`
    if (!entryIds.has(v.entry)) errors.push(`${loc}: unknown entry "${v.entry}"`)
    if (!editionIds.has(v.edition)) errors.push(`${loc}: unknown edition "${v.edition}"`)
    if (
      entryScheme.has(v.entry) &&
      editionScheme.has(v.edition) &&
      entryScheme.get(v.entry) !== editionScheme.get(v.edition)
    ) {
      errors.push(
        `${loc}: entry "${v.entry}" (${entryScheme.get(v.entry)}) cannot cite edition "${v.edition}" (${editionScheme.get(v.edition)})`,
      )
    }
    const page = parseIntStrict(v.page)
    if (page === null || page < 1) {
      errors.push(`${loc}: invalid page "${v.page}"`)
    } else if (!pageKeys.has(`${v.edition}#${page}`)) {
      errors.push(`${loc}: unknown page (${v.edition}, ${page})`)
    }
    if (!isOneOf(v.role, SIGHTING_ROLES)) errors.push(`${loc}: invalid role "${v.role}"`)
    const pos = parseIntStrict(v.pos)
    if (pos === null || pos < 1) {
      errors.push(`${loc}: invalid pos "${v.pos}"`)
    } else if (v.role === 'base' && entryIds.has(v.entry) && !entryBaseKeys.has(`${v.entry}#${pos}`)) {
      errors.push(`${loc}: base sighting pos ${pos} has no matching entry_base for "${v.entry}"`)
    }

    const x = parseFloatStrict(v.x)
    const y = parseFloatStrict(v.y)
    const w = parseFloatStrict(v.w)
    const h = parseFloatStrict(v.h)
    if (x === null || y === null || w === null || h === null) {
      errors.push(`${loc}: non-numeric bounding box (${v.x}, ${v.y}, ${v.w}, ${v.h})`)
    } else if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
      errors.push(`${loc}: bounding box out of page bounds (${x}, ${y}, ${w}, ${h})`)
    }

    dataset.sightings.push({
      entry: v.entry,
      edition: v.edition,
      page: page ?? 0,
      role: (isOneOf(v.role, SIGHTING_ROLES) ? v.role : 'form') as SightingRole,
      pos: pos ?? 0,
      x: x ?? 0,
      y: y ?? 0,
      w: w ?? 0,
      h: h ?? 0,
    })
  }

  // 10. links.tsv
  const linksParsed = parseTsv(TABLE_FILES.links, raw.links, TABLE_COLUMNS.links)
  errors.push(...linksParsed.errors)
  for (const { line, values: v } of linksParsed.rows) {
    const loc = `${TABLE_FILES.links}:${line}`
    if (!formIds.has(v.form)) errors.push(`${loc}: unknown form "${v.form}"`)
    if (!headIds.has(v.head)) errors.push(`${loc}: unknown head "${v.head}"`)
    if (!isOneOf(v.relation, LINK_RELATIONS)) errors.push(`${loc}: invalid relation "${v.relation}"`)
    if (!v.source.trim()) errors.push(`${loc}: link must name its source`)

    dataset.links.push({
      form: v.form,
      head: v.head,
      relation: (isOneOf(v.relation, LINK_RELATIONS) ? v.relation : 'same') as LinkRelation,
      condition: v.condition,
      source: v.source,
      citation: v.citation,
      note: v.note,
    })
  }

  // 11. rules.tsv
  const rulesParsed = parseTsv(TABLE_FILES.rules, raw.rules, TABLE_COLUMNS.rules)
  errors.push(...rulesParsed.errors)
  for (const { line, values: v } of rulesParsed.rows) {
    const loc = `${TABLE_FILES.rules}:${line}`
    if (!schemeIds.has(v.scheme)) errors.push(`${loc}: unknown scheme "${v.scheme}"`)
    if (!formIds.has(v.component)) errors.push(`${loc}: unknown component form "${v.component}"`)
    if (!formIds.has(v.reduced_component)) {
      errors.push(`${loc}: unknown reduced_component form "${v.reduced_component}"`)
    }
    if (!v.scope.trim()) errors.push(`${loc}: empty scope`)

    dataset.rules.push({
      scheme: v.scheme,
      component: v.component,
      reduced_component: v.reduced_component,
      scope: v.scope,
    })
  }

  // 12. checks.tsv
  const checksParsed = parseTsv(TABLE_FILES.checks, raw.checks, TABLE_COLUMNS.checks)
  errors.push(...checksParsed.errors)
  for (const { line, values: v } of checksParsed.rows) {
    const loc = `${TABLE_FILES.checks}:${line}`
    if (!schemeIds.has(v.scheme)) errors.push(`${loc}: unknown scheme "${v.scheme}"`)
    if (!isOneOf(v.metric, CHECK_METRICS)) errors.push(`${loc}: invalid metric "${v.metric}"`)
    const printed = parseIntStrict(v.printed)
    const counted = parseIntStrict(v.counted)
    if (printed === null || printed < 0) errors.push(`${loc}: invalid printed count "${v.printed}"`)
    if (counted === null || counted < 0) errors.push(`${loc}: invalid counted count "${v.counted}"`)

    dataset.checks.push({
      scheme: v.scheme,
      section: v.section,
      metric: (isOneOf(v.metric, CHECK_METRICS) ? v.metric : 'entries') as CheckMetric,
      printed: printed ?? 0,
      counted: counted ?? 0,
      note: v.note,
    })
  }

  // Cross-table invariants: scheme state vs entries & checks
  const entriesByScheme = new Map<string, EntryRow[]>()
  for (const entry of dataset.entries) {
    const list = entriesByScheme.get(entry.scheme) ?? []
    list.push(entry)
    entriesByScheme.set(entry.scheme, list)
  }

  for (const scheme of dataset.schemes) {
    const list = entriesByScheme.get(scheme.id) ?? []
    if (scheme.state === 'checked') {
      if (list.length === 0) {
        errors.push(`${TABLE_FILES.schemes}: checked scheme "${scheme.id}" has no entries`)
      }
      const unverified = list.filter((e) => e.check === '' || e.check === 'different')
      if (unverified.length > 0) {
        errors.push(
          `${TABLE_FILES.schemes}: checked scheme "${scheme.id}" has ${unverified.length} unverified or differing entries`,
        )
      }
    } else if (scheme.state === 'transcribed' && list.length === 0) {
      errors.push(`${TABLE_FILES.schemes}: transcribed scheme "${scheme.id}" has no entries`)
    }
  }

  // Cross-check checks.tsv totals against actual print entries/rules
  const basesByEntry = new Map<string, EntryBaseRow[]>()
  for (const base of dataset.entry_bases) {
    const list = basesByEntry.get(base.entry) ?? []
    list.push(base)
    basesByEntry.set(base.entry, list)
  }

  for (const chk of dataset.checks) {
    if (!schemeIds.has(chk.scheme)) continue
    const printEntries = (entriesByScheme.get(chk.scheme) ?? []).filter(
      (e) => e.origin === 'print' && (chk.section === '' || e.section === chk.section),
    )
    let actual = 0
    if (chk.metric === 'entries') {
      actual = printEntries.length
    } else if (chk.metric === 'forms') {
      actual = new Set(printEntries.map((e) => e.form)).size
    } else if (chk.metric === 'bases') {
      actual = printEntries.reduce((sum, e) => sum + (basesByEntry.get(e.id)?.length ?? 0), 0)
    } else if (chk.metric === 'rules') {
      actual = dataset.rules.filter((r) => r.scheme === chk.scheme).length
    }

    if (actual !== chk.counted) {
      errors.push(
        `${TABLE_FILES.checks}: scheme "${chk.scheme}" section "${chk.section || '*'}" metric "${chk.metric}" declares counted=${chk.counted}, actual=${actual}`,
      )
    }
    const scheme = schemeMap.get(chk.scheme)
    if (scheme?.state === 'checked' && chk.printed !== chk.counted && !chk.note.trim()) {
      errors.push(
        `${TABLE_FILES.checks}: checked scheme "${chk.scheme}" section "${chk.section || '*'}" has printed=${chk.printed} != counted=${chk.counted} without an explanatory note`,
      )
    }
  }

  return { dataset, errors }
}

export function validateDataDir(dataDir: string): ValidationResult {
  return validateTables(loadRawTables(dataDir))
}
