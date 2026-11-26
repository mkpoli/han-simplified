#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TABLE_COLUMNS, TABLE_FILES } from '../src/lib/data/schema'
import { validateDataDir } from '../src/lib/data/validate'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const OUT_DIR = join(ROOT, 'src', 'lib', 'generated')

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
      `Validated ${dataset.schemes.length} schemes, ${dataset.editions.length} editions, ${dataset.pages.length} pages across 12 tables with 0 errors.`,
    )
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  await Promise.all([
    writeFile(join(OUT_DIR, 'schemes.json'), `${JSON.stringify(dataset.schemes, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'editions.json'), `${JSON.stringify(dataset.editions, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'pages.json'), `${JSON.stringify(dataset.pages, null, 2)}\n`),
    writeFile(
      join(OUT_DIR, 'media-manifest.json'),
      `${JSON.stringify(dataset.media_manifest, null, 2)}\n`,
    ),
  ])
  console.log(
    `Validated and built ${dataset.schemes.length} schemes, ${dataset.editions.length} editions, ${dataset.pages.length} pages -> src/lib/generated/`,
  )
}

await main()
