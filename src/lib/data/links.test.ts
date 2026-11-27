import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { HeadsPayload, SchemeBundle } from '../../../scripts/build-data'
import { validateDataDir } from './validate'

const DATA_DIR = resolve(import.meta.dir, '../../../data')
const STATIC_DATA_DIR = resolve(import.meta.dir, '../../../static/data')

describe('sourced cross-scheme links and heads', () => {
  it('ensures every link has an explicit source and keeps merged heads separate', () => {
    const { dataset, errors } = validateDataDir(DATA_DIR)
    expect(errors).toEqual([])
    expect(dataset.heads.length).toBeGreaterThan(3500)
    expect(dataset.links.length).toBeGreaterThan(8000)

    // Zero unsourced links
    expect(dataset.links.every((l) => l.source.trim().length > 0)).toBe(true)

    // 發 (U+767C) and 髮 (U+9AEE) remain two distinct heads that both link to 发 (U+53D1)
    const heads = JSON.parse(readFileSync(join(STATIC_DATA_DIR, 'heads.json'), 'utf8')) as HeadsPayload
    expect(heads.heads.some((h) => h.text === '發')).toBe(true)
    expect(heads.heads.some((h) => h.text === '髮')).toBe(true)
    const faHeads = heads.charToHeads['发'] ?? []
    const faHeadChars = faHeads.map((id) => heads.heads.find((h) => h.id === id)?.text)
    expect(faHeadChars).toContain('發')
    expect(faHeadChars).toContain('髮')

    // 懶 joins across cn-1964 (懒) and cn-1977 (𰑐) via official cn-1964 link
    const lanHead = heads.heads.find((h) => h.text === '懶')
    expect(lanHead).toBeDefined()
    expect(lanHead!.schemes).toContain('cn-1964')
    expect(lanHead!.schemes).toContain('cn-1977')

    // 鹽 joins across cn-1935 (𥂁), cn-1964 (盐), and jp-1949 (塩)
    const yanHead = heads.heads.find((h) => h.text === '鹽')
    expect(yanHead).toBeDefined()
    expect(yanHead!.schemes).toContain('cn-1935')
    expect(yanHead!.schemes).toContain('cn-1964')
    expect(yanHead!.schemes).toContain('jp-1949')

    // 道 joins across cn-1977 (辺) and jp-1949 (listed unchanged 道)
    const daoHead = heads.heads.find((h) => h.text === '道')
    expect(daoHead).toBeDefined()
    expect(daoHead!.schemes).toContain('cn-1977')
    expect(daoHead!.schemes).toContain('jp-1949')

    // 藏 joins across cn-1977 (䒙) and jp-1949 (蔵)
    const cangHead = heads.heads.find((h) => h.text === '藏')
    expect(cangHead).toBeDefined()
    expect(cangHead!.schemes).toContain('cn-1977')
    expect(cangHead!.schemes).toContain('jp-1949')

    const s77 = JSON.parse(readFileSync(join(STATIC_DATA_DIR, 'scheme-cn-1977.json'), 'utf8')) as SchemeBundle
    expect(s77.byHead[lanHead!.id]?.length).toBeGreaterThan(0)
  })
})
