#!/usr/bin/env bun
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codepointToText } from '../src/lib/data/forms'
import {
  TABLE_COLUMNS,
  TABLE_FILES,
  type CheckRow,
  type EntryBaseRow,
  type EntryRow,
  type FormRow,
  type HeadRow,
  type LinkRow,
  type RuleRow,
  type SightingRow,
} from '../src/lib/data/schema'
import { validateDataDir } from '../src/lib/data/validate'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const OUT_DIR = join(ROOT, 'src', 'lib', 'generated')
const STATIC_DATA_DIR = join(ROOT, 'static', 'data')

export interface SchemeBundle {
  scheme: string
  entries: EntryRow[]
  bases: Record<string, EntryBaseRow[]>
  sightings: Record<string, SightingRow[]>
  forms: Record<string, FormRow>
  rules: RuleRow[]
  checks: CheckRow[]
  /** Maps head ID -> entry IDs in this scheme (computed via sourced links.tsv). */
  byHead: Record<string, string[]>
}

export interface HeadSummary {
  id: string
  form: string
  cp: string
  text: string
  ids: string
  kind: HeadRow['kind']
  /** Schemes that list this head (diff or inventory), for fast filtering before loading bundles. */
  schemes: string[]
}

export interface HeadsPayload {
  heads: HeadSummary[]
  /** Maps encoded text (e.g. "发" or "發") -> head IDs that link to that form. */
  charToHeads: Record<string, string[]>
  /** Maps unencoded form ID -> head IDs and scheme IDs. */
  formToHeads: Record<string, string[]>
}

async function main() {
  const checkOnly = process.argv.includes('--check')

  if (process.argv.includes('--init-empty')) {
    await mkdir(DATA_DIR, { recursive: true })
    for (const [key, cols] of Object.entries(TABLE_COLUMNS)) {
      const file = join(DATA_DIR, TABLE_FILES[key as keyof typeof TABLE_FILES])
      if (!(await Bun.file(file).exists())) {
        await writeFile(file, `${cols.join('\t')}\n`)
      }
    }
  }

  const { dataset, errors } = validateDataDir(DATA_DIR)
  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`)
    for (const err of errors) console.error(`  - ${err}`)
    process.exit(1)
  }

  if (checkOnly) {
    console.log(
      `Validated ${dataset.schemes.length} schemes, ${dataset.editions.length} editions, ${dataset.pages.length} pages, ${dataset.entries.length} entries, ${dataset.sightings.length} sightings, ${dataset.forms.length} forms, ${dataset.heads.length} heads, ${dataset.links.length} links across 12 tables with 0 errors.`,
    )
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(STATIC_DATA_DIR, { recursive: true })

  // Index auxiliary tables
  const schemeById = new Map(dataset.schemes.map((s) => [s.id, s]))
  const formById = new Map(dataset.forms.map((f) => [f.id, f]))
  const headByForm = new Map(dataset.heads.map((h) => [h.form, h]))

  const basesByEntry = new Map<string, EntryBaseRow[]>()
  for (const b of dataset.entry_bases) {
    const list = basesByEntry.get(b.entry) ?? []
    list.push(b)
    basesByEntry.set(b.entry, list)
  }
  for (const list of basesByEntry.values()) list.sort((a, b) => a.pos - b.pos)

  const sightingsByEntry = new Map<string, SightingRow[]>()
  const pageEntryCounts: Record<string, number> = {}
  const pageSeenEntries = new Map<string, Set<string>>()
  for (const s of dataset.sightings) {
    const list = sightingsByEntry.get(s.entry) ?? []
    list.push(s)
    sightingsByEntry.set(s.entry, list)
    const pk = `${s.edition}#${s.page}`
    let seen = pageSeenEntries.get(pk)
    if (!seen) {
      seen = new Set()
      pageSeenEntries.set(pk, seen)
    }
    seen.add(s.entry)
  }
  for (const [pk, set] of pageSeenEntries) {
    pageEntryCounts[pk] = set.size
  }

  // Build form -> heads map from sourced links.tsv
  const formToHeadsSet = new Map<string, Set<string>>()
  for (const l of dataset.links) {
    let set = formToHeadsSet.get(l.form)
    if (!set) {
      set = new Set()
      formToHeadsSet.set(l.form, set)
    }
    set.add(l.head)
  }

  // Group entries, rules, checks by scheme
  const entriesByScheme = new Map<string, EntryRow[]>()
  for (const e of dataset.entries) {
    const list = entriesByScheme.get(e.scheme) ?? []
    list.push(e)
    entriesByScheme.set(e.scheme, list)
  }
  for (const list of entriesByScheme.values()) list.sort((a, b) => a.order - b.order)

  const rulesByScheme = new Map<string, RuleRow[]>()
  for (const r of dataset.rules) {
    const list = rulesByScheme.get(r.scheme) ?? []
    list.push(r)
    rulesByScheme.set(r.scheme, list)
  }

  const checksByScheme = new Map<string, CheckRow[]>()
  for (const c of dataset.checks) {
    const list = checksByScheme.get(c.scheme) ?? []
    list.push(c)
    checksByScheme.set(c.scheme, list)
  }

  // Track which schemes cover each head
  const headSchemes = new Map<string, Set<string>>()

  const existingStatic = await readdir(STATIC_DATA_DIR).catch(() => [] as string[])
  const activeBundleNames = new Set<string>()
  const bundleWrites: Promise<void>[] = []

  for (const [schemeId, schemeEntries] of entriesByScheme) {
    const fileName = `scheme-${schemeId}.json`
    activeBundleNames.add(fileName)
    const bases: Record<string, EntryBaseRow[]> = {}
    const sightings: Record<string, SightingRow[]> = {}
    const forms: Record<string, FormRow> = {}
    const byHead: Record<string, string[]> = {}
    const isInventory = schemeById.get(schemeId)?.coverage === 'inventory'

    const addForm = (fid: string) => {
      if (forms[fid]) return
      const f = formById.get(fid)
      if (f) forms[fid] = f
    }

    const linkEntryToHead = (headId: string, entryId: string) => {
      const list = byHead[headId] ?? (byHead[headId] = [])
      if (!list.includes(entryId)) list.push(entryId)
      let schSet = headSchemes.get(headId)
      if (!schSet) {
        schSet = new Set()
        headSchemes.set(headId, schSet)
      }
      schSet.add(schemeId)
    }

    for (const e of schemeEntries) {
      addForm(e.form)
      const bs = basesByEntry.get(e.id)
      if (bs && bs.length > 0) {
        bases[e.id] = bs
        for (const b of bs) {
          addForm(b.form)
          // Resolve base -> head(s) through sourced links (or direct head match)
          const directHead = headByForm.get(b.form)
          if (directHead) {
            linkEntryToHead(directHead.id, e.id)
          } else {
            const linked = formToHeadsSet.get(b.form)
            if (linked) {
              for (const hid of linked) linkEntryToHead(hid, e.id)
            }
          }
        }
      } else if (isInventory) {
        // Inventory scheme unchanged character (e.g. jp-1949 一, 餐)
        const directHead = headByForm.get(e.form)
        if (directHead) {
          linkEntryToHead(directHead.id, e.id)
        } else {
          const linked = formToHeadsSet.get(e.form)
          if (linked) {
            for (const hid of linked) linkEntryToHead(hid, e.id)
          }
        }
      }

      const ss = sightingsByEntry.get(e.id)
      if (ss && ss.length > 0) {
        sightings[e.id] = ss
      }
    }
    const schemeRules = rulesByScheme.get(schemeId) ?? []
    for (const r of schemeRules) {
      addForm(r.component)
      addForm(r.reduced_component)
    }

    const bundle: SchemeBundle = {
      scheme: schemeId,
      entries: schemeEntries,
      bases,
      sightings,
      forms,
      rules: schemeRules,
      checks: checksByScheme.get(schemeId) ?? [],
      byHead,
    }
    bundleWrites.push(writeFile(join(STATIC_DATA_DIR, fileName), JSON.stringify(bundle)))
  }

  for (const file of existingStatic) {
    if (file.startsWith('scheme-') && file.endsWith('.json') && !activeBundleNames.has(file)) {
      bundleWrites.push(unlink(join(STATIC_DATA_DIR, file)))
    }
  }

  // Build static/data/heads.json and static/data/links.json
  const headsList: HeadSummary[] = dataset.heads.map((h) => {
    const f = formById.get(h.form)
    const cp = f?.codepoint ?? ''
    return {
      id: h.id,
      form: h.form,
      cp,
      text: codepointToText(cp),
      ids: f?.ids ?? '',
      kind: h.kind,
      schemes: [...(headSchemes.get(h.id) ?? [])].sort(),
    }
  })

  const charToHeads: Record<string, string[]> = {}
  const formToHeads: Record<string, string[]> = {}
  const addCharHead = (txt: string, hid: string) => {
    if (!txt) return
    const list = charToHeads[txt] ?? (charToHeads[txt] = [])
    if (!list.includes(hid)) list.push(hid)
  }

  for (const h of headsList) {
    addCharHead(h.text, h.id)
  }
  for (const [fid, hset] of formToHeadsSet) {
    const arr = [...hset]
    formToHeads[fid] = arr
    const f = formById.get(fid)
    const txt = f ? codepointToText(f.codepoint) : ''
    if (txt) {
      for (const hid of arr) addCharHead(txt, hid)
    }
  }

  const headsPayload: HeadsPayload = {
    heads: headsList,
    charToHeads,
    formToHeads,
  }

  const linksPayload: { links: LinkRow[] } = {
    links: dataset.links,
  }

  await Promise.all([
    writeFile(join(OUT_DIR, 'schemes.json'), `${JSON.stringify(dataset.schemes, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'editions.json'), `${JSON.stringify(dataset.editions, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'pages.json'), `${JSON.stringify(dataset.pages, null, 2)}\n`),
    writeFile(
      join(OUT_DIR, 'media-manifest.json'),
      `${JSON.stringify(dataset.media_manifest, null, 2)}\n`,
    ),
    writeFile(join(OUT_DIR, 'checks.json'), `${JSON.stringify(dataset.checks, null, 2)}\n`),
    writeFile(
      join(OUT_DIR, 'page-entry-counts.json'),
      `${JSON.stringify(pageEntryCounts, null, 2)}\n`,
    ),
    writeFile(join(STATIC_DATA_DIR, 'heads.json'), JSON.stringify(headsPayload)),
    writeFile(join(STATIC_DATA_DIR, 'links.json'), JSON.stringify(linksPayload)),
    ...bundleWrites,
  ])
  console.log(
    `Validated and built ${dataset.schemes.length} schemes, ${dataset.editions.length} editions, ${dataset.pages.length} pages, ${dataset.entries.length} entries, ${dataset.heads.length} heads, ${dataset.links.length} links -> src/lib/generated/ & static/data/`,
  )
}

await main()
