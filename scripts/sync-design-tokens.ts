#!/usr/bin/env bun
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY = 'mkpoli/glyph-atlas'
const COMMIT = '9774d2c8ce23d5fab219f0d7df7cf7853bb26f31'
const SOURCE_DIR = 'packages/design-system/src'
const FILES = ['tokens.css', 'base.css', 'components.css'] as const

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'src', 'lib', 'design')

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function readSource(file: string, localRepo: string | undefined): Promise<Buffer> {
  const repoPath = `${SOURCE_DIR}/${file}`
  if (localRepo) {
    const proc = Bun.spawn(['git', '-C', localRepo, 'show', `${COMMIT}:${repoPath}`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (code !== 0) {
      throw new Error(`git show ${COMMIT}:${repoPath} in ${localRepo} failed (${code}): ${err.trim()}`)
    }
    return Buffer.from(out)
  }

  const url = `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/${repoPath}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const localRepo = argValue('--from-repo') ?? process.env.GLYPH_ATLAS_LOCAL
  await mkdir(OUT_DIR, { recursive: true })

  const manifestFiles: Record<string, { sha256: string; bytes: number }> = {}
  for (const file of FILES) {
    const content = await readSource(file, localRepo)
    const sha256 = createHash('sha256').update(content).digest('hex')
    await writeFile(join(OUT_DIR, file), content)
    manifestFiles[file] = { sha256, bytes: content.byteLength }
  }

  const manifest = {
    repository: REPOSITORY,
    commit: COMMIT,
    sourceDir: SOURCE_DIR,
    files: manifestFiles,
  }
  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Synced ${FILES.length} design-system files from ${REPOSITORY}@${COMMIT.slice(0, 12)}`)
}

await main()
