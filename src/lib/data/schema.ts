export const COUNTRIES = ['cn', 'jp', 'kr', 'sg', 'my'] as const
export type Country = (typeof COUNTRIES)[number]

export const SCHEME_KINDS = ['adopted', 'withdrawn', 'draft', 'civic'] as const
export type SchemeKind = (typeof SCHEME_KINDS)[number]

export const SCHEME_COVERAGES = ['diff', 'inventory'] as const
export type SchemeCoverage = (typeof SCHEME_COVERAGES)[number]

export const SCHEME_STATES = ['checked', 'transcribed', 'listed'] as const
export type SchemeState = (typeof SCHEME_STATES)[number]

export const PAGE_SIDES = ['full', 'left', 'right'] as const
export type PageSide = (typeof PAGE_SIDES)[number]

export const ENTRY_KINDS = ['character', 'word', 'component'] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]

export const ENTRY_ORIGINS = ['print', 'compilation', 'editor'] as const
export type EntryOrigin = (typeof ENTRY_ORIGINS)[number]

export const CHECK_VERDICTS = ['', 'same', 'different', 'illegible'] as const
export type CheckVerdict = (typeof CHECK_VERDICTS)[number]

export const SIGHTING_ROLES = ['base', 'form'] as const
export type SightingRole = (typeof SIGHTING_ROLES)[number]

export const LINK_RELATIONS = [
  'same',
  'simplification',
  'variant',
  'merge',
  'split',
  'component',
] as const
export type LinkRelation = (typeof LINK_RELATIONS)[number]

export const CHECK_METRICS = ['entries', 'bases', 'forms', 'rules'] as const
export type CheckMetric = (typeof CHECK_METRICS)[number]

export const TABLE_COLUMNS = {
  schemes: [
    'id',
    'country',
    'year',
    'title',
    'kind',
    'coverage',
    'body',
    'adopted_on',
    'withdrawn_on',
    'replaces',
    'state',
  ],
  editions: [
    'id',
    'scheme',
    'title',
    'imprint',
    'holder',
    'source_url',
    'supplied_by',
    'retrieved_on',
    'sha256',
    'note',
  ],
  pages: [
    'edition',
    'seq',
    'printed_label',
    'side',
    'raw_sha256',
    'transform',
    'width',
    'height',
    'image_key',
  ],
  entries: [
    'id',
    'scheme',
    'section',
    'order',
    'printed_row',
    'kind',
    'form',
    'condition',
    'footnote',
    'origin',
    'check',
  ],
  entry_bases: ['entry', 'pos', 'form', 'lang'],
  sightings: ['entry', 'edition', 'page', 'role', 'pos', 'x', 'y', 'w', 'h'],
  forms: ['id', 'codepoint', 'ids', 'compendium_record'],
  heads: ['id', 'form', 'kind'],
  links: ['form', 'head', 'relation', 'condition', 'source', 'citation', 'note'],
  rules: ['scheme', 'component', 'reduced_component', 'scope'],
  checks: ['scheme', 'section', 'metric', 'printed', 'counted', 'note'],
  media_manifest: ['image_key', 'edition', 'page', 'sha256', 'width', 'height', 'widths'],
} as const

export const TABLE_FILES: Record<keyof typeof TABLE_COLUMNS, string> = {
  schemes: 'schemes.tsv',
  editions: 'editions.tsv',
  pages: 'pages.tsv',
  entries: 'entries.tsv',
  entry_bases: 'entry_bases.tsv',
  sightings: 'sightings.tsv',
  forms: 'forms.tsv',
  heads: 'heads.tsv',
  links: 'links.tsv',
  rules: 'rules.tsv',
  checks: 'checks.tsv',
  media_manifest: 'media-manifest.tsv',
}

export interface SchemeRow {
  id: string
  country: Country
  year: number
  title: string
  kind: SchemeKind
  coverage: SchemeCoverage
  body: string
  adopted_on: string
  withdrawn_on: string
  replaces: string[]
  state: SchemeState
}

export interface EditionRow {
  id: string
  scheme: string
  title: string
  imprint: string
  holder: string
  source_url: string
  supplied_by: string
  retrieved_on: string
  sha256: string
  note: string
}

export interface PageRow {
  edition: string
  seq: number
  printed_label: string
  side: PageSide
  raw_sha256: string
  transform: string
  width: number
  height: number
  image_key: string
}

export interface EntryRow {
  id: string
  scheme: string
  section: string
  order: number
  printed_row: string
  kind: EntryKind
  form: string
  condition: string
  footnote: string
  origin: EntryOrigin
  check: CheckVerdict
}

export interface EntryBaseRow {
  entry: string
  pos: number
  form: string
  lang: string
}

export interface SightingRow {
  entry: string
  edition: string
  page: number
  role: SightingRole
  pos: number
  x: number
  y: number
  w: number
  h: number
}

export interface FormRow {
  id: string
  codepoint: string
  ids: string
  compendium_record: string
}

export interface HeadRow {
  id: string
  form: string
  kind: EntryKind
}

export interface LinkRow {
  form: string
  head: string
  relation: LinkRelation
  condition: string
  source: string
  citation: string
  note: string
}

export interface RuleRow {
  scheme: string
  component: string
  reduced_component: string
  scope: string
}

export interface CheckRow {
  scheme: string
  section: string
  metric: CheckMetric
  printed: number
  counted: number
  note: string
}

export interface MediaManifestRow {
  image_key: string
  edition: string
  page: number
  sha256: string
  width: number
  height: number
  widths: number[]
}

export interface Dataset {
  schemes: SchemeRow[]
  editions: EditionRow[]
  pages: PageRow[]
  entries: EntryRow[]
  entry_bases: EntryBaseRow[]
  sightings: SightingRow[]
  forms: FormRow[]
  heads: HeadRow[]
  links: LinkRow[]
  rules: RuleRow[]
  checks: CheckRow[]
  media_manifest: MediaManifestRow[]
}

/** Language tag for rendering a scheme's native title, body, and forms. */
export function schemeLang(scheme: Pick<SchemeRow, 'country' | 'year'>): string {
  if (scheme.country === 'jp') return 'ja'
  if (scheme.country === 'kr') return 'ko'
  if (scheme.country === 'cn' && scheme.year <= 1935) return 'zh-Hant'
  return 'zh-Hans'
}
