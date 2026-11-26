#!/usr/bin/env bun
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TABLE_COLUMNS, TABLE_FILES } from '../src/lib/data/schema'
import { parseTsv } from '../src/lib/data/tsv'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const BUCKET = 'han-simplified'
const TARGET_WIDTHS = [320, 1600] as const

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function run(cmd: string[], cwd?: string, retries = 0): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (code === 0) return out.trim()
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    throw new Error(`Command failed (${code}): ${cmd.join(' ')}\n${err.trim()}`)
  }
  throw new Error(`Unreachable retry exit: ${cmd.join(' ')}`)
}

async function sha256File(path: string): Promise<string> {
  const buf = await readFile(path)
  return createHash('sha256').update(buf).digest('hex')
}

async function upsertTsv(
  fileName: string,
  columns: readonly string[],
  filterOut: (row: Record<string, string>) => boolean,
  newRows: Array<Record<string, string>>,
) {
  const filePath = join(DATA_DIR, fileName)
  const existing = await readFile(filePath, 'utf8')
  const parsed = parseTsv(fileName, existing, columns)
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot update ${fileName}: ${parsed.errors.join('; ')}`)
  }
  const kept = parsed.rows.map((r) => r.values).filter((r) => !filterOut(r))
  const all = [...kept, ...newRows]
  const lines = [
    columns.join('\t'),
    ...all.map((row) => columns.map((col) => row[col] ?? '').join('\t')),
  ]
  await writeFile(filePath, `${lines.join('\n')}\n`)
}

async function main() {
  const edition = arg('--edition')
  const pdf = arg('--pdf')
  const labelsRaw = arg('--labels') ?? ''
  const uploadRemote = process.argv.includes('--upload')
  const uploadLocal = process.argv.includes('--local')
  const outCache = arg('--out-dir')

  if (!edition || !pdf) {
    console.error(
      'Usage: bun scripts/ingest-pages.ts --edition <id> --pdf <path> [--labels l1,l2,...] [--upload] [--local] [--out-dir <dir>]',
    )
    process.exit(1)
  }

  const labels = labelsRaw ? labelsRaw.split(',') : []
  const workDir = await mkdtemp(join(tmpdir(), `ingest-${edition}-`))
  const rawDir = join(workDir, 'raw')
  const webpDir = outCache ? resolve(outCache) : join(workDir, 'webp')
  await mkdir(rawDir, { recursive: true })
  await mkdir(webpDir, { recursive: true })

  try {
    await run(['pdfimages', '-j', resolve(pdf), join(rawDir, 'p')])
    const rawFiles = (await readdir(rawDir))
      .filter((f) => /^p-\d+\.(jpg|jpeg|png|ppm|pbm)$/i.test(f))
      .sort()

    if (rawFiles.length === 0) {
      throw new Error(`pdfimages extracted 0 images from ${pdf}`)
    }

    const pageRows: Array<Record<string, string>> = []
    const manifestRows: Array<Record<string, string>> = []

    for (let i = 0; i < rawFiles.length; i++) {
      const seq = i + 1
      const rawPath = join(rawDir, rawFiles[i])
      const rawSha = await sha256File(rawPath)
      const [wStr, hStr] = (await run(['magick', 'identify', '-format', '%w %h', rawPath])).split(
        /\s+/,
      )
      const width = Number(wStr)
      const height = Number(hStr)
      if (!width || !height) throw new Error(`Invalid dimensions for ${rawPath}`)

      const imageKey = `pages/${rawSha}`
      const targetDir = join(webpDir, imageKey)
      await mkdir(targetDir, { recursive: true })

      const fullOut = join(targetDir, 'full.webp')
      await run(['magick', rawPath, '-quality', '88', fullOut])
      const fullSha = await sha256File(fullOut)

      const generatedWidths: number[] = []
      const uploads: Array<{ key: string; file: string }> = [
        { key: `${imageKey}/full.webp`, file: fullOut },
      ]

      for (const tw of TARGET_WIDTHS) {
        const wOut = join(targetDir, `w${tw}.webp`)
        await run(['magick', rawPath, '-resize', `${tw}x>`, '-quality', '84', wOut])
        generatedWidths.push(tw)
        uploads.push({ key: `${imageKey}/w${tw}.webp`, file: wOut })
      }
      generatedWidths.push(width)

      for (const item of uploads) {
        if (uploadRemote) {
          await run(
            [
              'bunx',
              'wrangler',
              'r2',
              'object',
              'put',
              `${BUCKET}/${item.key}`,
              '--file',
              item.file,
              '--content-type',
              'image/webp',
              '--remote',
            ],
            ROOT,
            2,
          )
        }
        if (uploadLocal) {
          await run(
            [
              'bunx',
              'wrangler',
              'r2',
              'object',
              'put',
              `${BUCKET}/${item.key}`,
              '--file',
              item.file,
              '--content-type',
              'image/webp',
              '--local',
            ],
            ROOT,
            2,
          )
        }
      }

      pageRows.push({
        edition,
        seq: String(seq),
        printed_label: labels[i] ?? String(seq),
        side: 'full',
        raw_sha256: rawSha,
        transform: 'none',
        width: String(width),
        height: String(height),
        image_key: imageKey,
      })

      manifestRows.push({
        image_key: imageKey,
        edition,
        page: String(seq),
        sha256: fullSha,
        width: String(width),
        height: String(height),
        widths: generatedWidths.join(','),
      })

      console.log(`Page ${seq}/${rawFiles.length}: ${width}x${height} -> ${imageKey}`)
    }

    await upsertTsv(
      TABLE_FILES.pages,
      TABLE_COLUMNS.pages,
      (r) => r.edition === edition,
      pageRows,
    )
    await upsertTsv(
      TABLE_FILES.media_manifest,
      TABLE_COLUMNS.media_manifest,
      (r) => r.edition === edition,
      manifestRows,
    )
    console.log(`Updated data/pages.tsv and data/media-manifest.tsv for ${edition}.`)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

await main()
