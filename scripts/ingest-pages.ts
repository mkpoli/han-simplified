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

function parsePageOrder(spec: string, total: number): number[] {
  if (!spec) return Array.from({ length: total }, (_, i) => i + 1)
  const out: number[] = []
  for (const part of spec.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const range = trimmed.match(/^(\d+)-(\d+)$/)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      const step = a <= b ? 1 : -1
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) out.push(n)
    } else {
      out.push(Number(trimmed))
    }
  }
  for (const n of out) {
    if (!Number.isInteger(n) || n < 1 || n > total) {
      throw new Error(`Page index ${n} out of range 1..${total}`)
    }
  }
  return out
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++
      if (idx >= items.length) break
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
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
  const pagesSpec = arg('--pages') ?? ''
  const splitSpreadsSpec = arg('--split-spreads') ?? ''
  const splitRtl = process.argv.includes('--rtl')
  const bilevel = process.argv.includes('--bilevel')
  const uploadRemote = process.argv.includes('--upload')
  const uploadLocal = process.argv.includes('--local')
  const outCache = arg('--out-dir')
  const concurrency = Math.max(1, Number(arg('--concurrency') ?? '4'))

  if (!edition || !pdf) {
    console.error(
      'Usage: bun scripts/ingest-pages.ts --edition <id> --pdf <path> [--bilevel] [--pages 2-31,1] [--split-spreads 2-8,11-15 --rtl] [--labels l1,l2,...] (--upload | --local | --out-dir <dir>)',
    )
    process.exit(1)
  }
  if (!uploadRemote && !uploadLocal && !outCache) {
    console.error(
      'Refusing to update TSVs without keeping generated WebP files: pass --upload, --local, or --out-dir <dir>.',
    )
    process.exit(1)
  }

  const labels = labelsRaw ? labelsRaw.split(',') : []
  const workDir = await mkdtemp(join(tmpdir(), `ingest-${edition}-`))
  const rawDir = join(workDir, 'raw')
  const prepDir = join(workDir, 'prep')
  const webpDir = outCache ? resolve(outCache) : join(workDir, 'webp')
  await mkdir(rawDir, { recursive: true })
  await mkdir(prepDir, { recursive: true })
  await mkdir(webpDir, { recursive: true })

  try {
    const extractFlag = bilevel ? '-png' : '-j'
    await run(['pdfimages', extractFlag, resolve(pdf), join(rawDir, 'p')])
    const rawFiles = (await readdir(rawDir))
      .filter((f) => /^p-\d+\.(jpg|jpeg|png|ppm|pbm)$/i.test(f))
      .sort()

    if (rawFiles.length === 0) {
      throw new Error(`pdfimages extracted 0 images from ${pdf}`)
    }

    const order = parsePageOrder(pagesSpec, rawFiles.length)
    const splitSet = new Set(splitSpreadsSpec ? parsePageOrder(splitSpreadsSpec, rawFiles.length) : [])

    interface PageWorkItem {
      seq: number
      rawPath: string
      side: 'full' | 'left' | 'right'
      transform: string
      label: string
    }

    const workItems: PageWorkItem[] = []
    let seqCounter = 0

    for (const srcNum of order) {
      let srcPath = join(rawDir, rawFiles[srcNum - 1])
      let transform = 'none'

      // Fix CCITT inverted stencil polarity (white ink on black background) without thresholding
      if (bilevel) {
        const meanStr = await run(['magick', 'identify', '-format', '%[fx:mean]', srcPath])
        if (Number(meanStr) < 0.5) {
          const negPath = join(prepDir, `neg-${srcNum}.png`)
          await run(['magick', srcPath, '-negate', negPath])
          srcPath = negPath
          transform = 'negate-ccitt'
        }
      }

      if (splitSet.has(srcNum)) {
        const [wStr, hStr] = (await run(['magick', 'identify', '-format', '%w %h', srcPath])).split(/\s+/)
        const W = Number(wStr)
        const H = Number(hStr)
        const half = Math.floor(W / 2)
        const leftPath = join(prepDir, `split-${srcNum}-left.jpg`)
        const rightPath = join(prepDir, `split-${srcNum}-right.jpg`)
        await run(['magick', srcPath, '-crop', `${half}x${H}+0+0`, '+repage', '-quality', '94', leftPath])
        await run(['magick', srcPath, '-crop', `${W - half}x${H}+${half}+0`, '+repage', '-quality', '94', rightPath])
        const pair: Array<{ path: string; side: 'left' | 'right' }> = splitRtl
          ? [
              { path: rightPath, side: 'right' },
              { path: leftPath, side: 'left' },
            ]
          : [
              { path: leftPath, side: 'left' },
              { path: rightPath, side: 'right' },
            ]
        for (const halfItem of pair) {
          seqCounter++
          workItems.push({
            seq: seqCounter,
            rawPath: halfItem.path,
            side: halfItem.side,
            transform: transform === 'none' ? `split-${halfItem.side}` : `${transform};split-${halfItem.side}`,
            label: labels[seqCounter - 1] ?? String(seqCounter),
          })
        }
      } else {
        seqCounter++
        workItems.push({
          seq: seqCounter,
          rawPath: srcPath,
          side: 'full',
          transform,
          label: labels[seqCounter - 1] ?? String(seqCounter),
        })
      }
    }

    const pageRows: Array<Record<string, string>> = new Array(workItems.length)
    const manifestRows: Array<Record<string, string>> = new Array(workItems.length)
    const uploads: Array<{ key: string; file: string }> = []

    await runPool(workItems, 4, async (item, idx) => {
      const rawSha = await sha256File(item.rawPath)
      const [wStr, hStr] = (await run(['magick', 'identify', '-format', '%w %h', item.rawPath])).split(
        /\s+/,
      )
      const width = Number(wStr)
      const height = Number(hStr)
      if (!width || !height) throw new Error(`Invalid dimensions for ${item.rawPath}`)

      const imageKey = `pages/${rawSha}`
      const targetDir = join(webpDir, imageKey)
      await mkdir(targetDir, { recursive: true })

      const fullOut = join(targetDir, 'full.webp')
      const fullArgs = bilevel
        ? ['magick', item.rawPath, '-define', 'webp:lossless=true', fullOut]
        : ['magick', item.rawPath, '-quality', '88', fullOut]
      await run(fullArgs)
      const fullSha = await sha256File(fullOut)

      const generatedWidths: number[] = []
      uploads.push({ key: `${imageKey}/full.webp`, file: fullOut })

      for (const tw of TARGET_WIDTHS) {
        const wOut = join(targetDir, `w${tw}.webp`)
        const resizeArgs = bilevel
          ? ['magick', item.rawPath, '-resize', `${tw}x>`, '-define', 'webp:lossless=true', wOut]
          : ['magick', item.rawPath, '-resize', `${tw}x>`, '-quality', '84', wOut]
        await run(resizeArgs)
        generatedWidths.push(tw)
        uploads.push({ key: `${imageKey}/w${tw}.webp`, file: wOut })
      }
      generatedWidths.push(width)

      pageRows[idx] = {
        edition,
        seq: String(item.seq),
        printed_label: item.label,
        side: item.side,
        raw_sha256: rawSha,
        transform: item.transform,
        width: String(width),
        height: String(height),
        image_key: imageKey,
      }

      manifestRows[idx] = {
        image_key: imageKey,
        edition,
        page: String(item.seq),
        sha256: fullSha,
        width: String(width),
        height: String(height),
        widths: generatedWidths.join(','),
      }
    })

    if (uploadRemote) {
      let done = 0
      await runPool(uploads, concurrency, async (item) => {
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
          3,
        )
        done++
        if (done % 15 === 0 || done === uploads.length) {
          console.log(`Uploaded remote ${done}/${uploads.length}`)
        }
      })
    }

    if (uploadLocal) {
      await runPool(uploads, 2, async (item) => {
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
      })
      console.log(`Uploaded local ${uploads.length}/${uploads.length}`)
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
    console.log(`Ingested ${workItems.length} pages for ${edition}.`)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

await main()
